import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { parseUnits, formatUnits, erc20Abi } from 'viem';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

import { abi as wrapAbi } from '@/config/abi/wrap';
import type { TokenConfig } from '@/types/config';
import { getTokenConfig } from '@/utils/app-config';

export function useTokenWrap() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | undefined>();
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'confirming' | 'success' | 'error'>(
    'idle'
  );
  const [loadingState, setLoadingState] = useState<{
    type: 'idle' | 'approving' | 'wrapping' | 'unwrapping' | 'refreshing';
    message?: string;
  }>({ type: 'idle' });
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);
  const [tokenConfig, setTokenConfig] = useState<{
    sourceToken: TokenConfig;
    wrapToken: TokenConfig;
    wrapContractAddress: `0x${string}`;
  } | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load token configuration
  useEffect(() => {
    getTokenConfig()
      .then((config) => {
        setTokenConfig(config);
        console.log('🪙 Token Config loaded:', config);
      })
      .catch(console.error);
  }, []);

  // Read FROM_TOKEN balance
  const { data: fromTokenBalance, refetch: refetchFromTokenBalance } = useReadContract({
    address: tokenConfig?.sourceToken.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!tokenConfig
    }
  });

  // Read TO_TOKEN balance
  const { data: toTokenBalance, refetch: refetchToTokenBalance } = useReadContract({
    address: tokenConfig?.wrapToken.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!tokenConfig
    }
  });

  // Read FROM_TOKEN allowance for TO_TOKEN contract
  const { data: fromTokenAllowance, refetch: refetchFromTokenAllowance } = useReadContract({
    address: tokenConfig?.sourceToken.address,
    abi: erc20Abi,
    functionName: 'allowance',
    args:
      address && tokenConfig?.wrapContractAddress
        ? [address, tokenConfig.wrapContractAddress]
        : undefined,
    query: {
      enabled: !!address && !!tokenConfig
    }
  });

  const {
    isLoading: isConfirming,
    isSuccess: isTransactionSuccess,
    isError: isTransactionError,
    error: transactionError
  } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}`,
    query: {
      enabled: !!txHash,
      retry: (failureCount, error) => {
        if (error?.message?.includes('could not be found')) {
          return failureCount < 10;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000)
    }
  });

  // Update transaction status based on receipt
  useEffect(() => {
    if (!txHash) {
      setTxStatus('idle');
      setLoadingState({ type: 'idle' });
    } else if (isConfirming) {
      setTxStatus('confirming');
    } else if (isTransactionSuccess) {
      setTxStatus('success');
      setLoadingState({ type: 'idle' });

      refetchFromTokenBalance();
      refetchToTokenBalance();
      refetchFromTokenAllowance();

      toast.success('Transaction confirmed successfully!', {
        autoClose: 3000,
        onClose: () => {
          setTxHash(undefined);
          setTxStatus('idle');
        }
      });
    } else if (isTransactionError) {
      setTxStatus('error');
      setLoadingState({ type: 'idle' });

      let errorMessage = 'Transaction failed';
      const shortMessage =
        (transactionError as any)?.shortMessage || (transactionError as any)?.message;

      if (shortMessage?.includes('could not be found')) {
        errorMessage =
          'Transaction is taking longer than expected. Please check your wallet or block explorer.';
      } else if (shortMessage?.includes('User rejected')) {
        errorMessage = 'Transaction was rejected by user';
      } else if (shortMessage?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for transaction';
      } else if (shortMessage?.includes('gas')) {
        errorMessage = 'Transaction failed due to gas issues';
      } else if (shortMessage) {
        errorMessage = shortMessage;
      }

      toast.error(errorMessage, {
        autoClose: 5000,
        onClose: () => {
          setTxHash(undefined);
          setTxStatus('idle');
        }
      });
    }
  }, [
    txHash,
    isConfirming,
    isTransactionSuccess,
    isTransactionError,
    transactionError,
    refetchFromTokenBalance,
    refetchToTokenBalance,
    refetchFromTokenAllowance
  ]);

  // Approve FROM_TOKEN for wrapping
  const approveFromToken = useCallback(
    async (amount: string) => {
      if (!address || !tokenConfig) {
        toast.error('Please connect your wallet');
        return;
      }

      try {
        setIsLoading(true);
        setTxStatus('pending');
        setLoadingState({ type: 'approving', message: `Approving ${tokenConfig.sourceToken.symbol}...` });
        const amountBigInt = parseUnits(amount, tokenConfig.sourceToken.decimals);

        const hash = await writeContractAsync({
          address: tokenConfig.sourceToken.address,
          abi: erc20Abi,
          functionName: 'approve',
          args: [tokenConfig.wrapContractAddress, amountBigInt]
        });

        setTxHash(hash);
        setTxStatus('confirming');

        return hash;
      } catch (error) {
        console.error('Approve error:', error);
        setTxStatus('error');
        setLoadingState({ type: 'idle' });
        toast.error(
          `Failed to approve ${tokenConfig?.sourceToken.symbol}: ${(error as any)?.shortMessage || (error as any)?.message || 'Unknown error'}`,
          {
            autoClose: 4000
          }
        );
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [address, tokenConfig, writeContractAsync]
  );

  // Check if approval is needed before wrapping
  const needsApproval = useCallback(
    (amount: string): boolean => {
      if (!fromTokenAllowance || !tokenConfig) {
        return true;
      }

      try {
        const amountBigInt = parseUnits(amount, tokenConfig.sourceToken.decimals);
        // Direct comparison using BigInt - fromTokenAllowance is already in raw units
        return fromTokenAllowance < amountBigInt;
      } catch (error) {
        console.error('Error parsing amount for approval check:', error);
        return true; // Safe default - require approval if parsing fails
      }
    },
    [fromTokenAllowance, tokenConfig]
  );

  // Wrap FROM_TOKEN to TO_TOKEN
  const wrapToken = useCallback(
    async (amount: string) => {
      if (!address || !tokenConfig) {
        toast.error('Please connect your wallet');
        return;
      }

      // Check if approval is needed first
      if (needsApproval(amount)) {
        toast.error(`Please approve ${tokenConfig.sourceToken.symbol} first`);
        return;
      }

      try {
        setIsLoading(true);
        setTxStatus('pending');
        setLoadingState({ type: 'wrapping', message: `Wrapping ${tokenConfig.sourceToken.symbol}...` });
        const amountBigInt = parseUnits(amount, tokenConfig.sourceToken.decimals);

        const hash = await writeContractAsync({
          address: tokenConfig.wrapContractAddress,
          abi: wrapAbi,
          functionName: 'depositFor',
          args: [address, amountBigInt]
        });

        setTxHash(hash);
        setTxStatus('confirming');

        return hash;
      } catch (error) {
        console.error('Wrap error:', error);
        setTxStatus('error');
        setLoadingState({ type: 'idle' });
        toast.error(
          `Failed to wrap ${tokenConfig?.sourceToken.symbol}: ${(error as any)?.shortMessage || (error as any)?.message || 'Unknown error'}`,
          {
            autoClose: 4000
          }
        );
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [address, tokenConfig, needsApproval, writeContractAsync]
  );

  // Unwrap TO_TOKEN to FROM_TOKEN
  const unwrapToken = useCallback(
    async (amount: string) => {
      if (!address || !tokenConfig) {
        toast.error('Please connect your wallet');
        return;
      }

      try {
        setIsLoading(true);
        setTxStatus('pending');
        setLoadingState({ type: 'unwrapping', message: `Unwrapping ${tokenConfig.wrapToken.symbol}...` });
        const amountBigInt = parseUnits(amount, tokenConfig.wrapToken.decimals);

        const hash = await writeContractAsync({
          address: tokenConfig.wrapContractAddress,
          abi: wrapAbi,
          functionName: 'withdrawTo',
          args: [address, amountBigInt]
        });

        setTxHash(hash);
        setTxStatus('confirming');

        return hash;
      } catch (error) {
        console.error('Unwrap error:', error);
        setTxStatus('error');
        setLoadingState({ type: 'idle' });
        toast.error(
          `Failed to unwrap ${tokenConfig?.wrapToken.symbol}: ${(error as any)?.shortMessage || (error as any)?.message || 'Unknown error'}`,
          {
            autoClose: 4000
          }
        );
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [address, tokenConfig, writeContractAsync]
  );
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    // Balances
    fromTokenBalance:
      fromTokenBalance && tokenConfig
        ? formatUnits(fromTokenBalance, tokenConfig.sourceToken.decimals)
        : '0',
    toTokenBalance:
      toTokenBalance && tokenConfig
        ? formatUnits(toTokenBalance, tokenConfig.wrapToken.decimals)
        : '0',
    fromTokenAllowance:
      fromTokenAllowance && tokenConfig
        ? formatUnits(fromTokenAllowance, tokenConfig.sourceToken.decimals)
        : '0',

    // Token info
    sourceToken: tokenConfig?.sourceToken || null,
    wrapToken: tokenConfig?.wrapToken || null,

    // Actions
    approveFromToken,
    wrap: wrapToken,
    unwrapToken,
    needsApproval,

    // States
    isLoading: isLoading || isConfirming,
    txHash,
    txStatus,
    isConfirming,

    // Refetch functions
    refetchBalances: async () => {
      setIsRefreshingBalances(true);
      setLoadingState({ type: 'refreshing', message: 'Refreshing balances...' });
      try {
        await Promise.all([
          refetchFromTokenBalance(),
          refetchToTokenBalance(),
          refetchFromTokenAllowance()
        ]);
      } finally {
        // Clear any existing timeout
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
        
        // Set new timeout
        refreshTimeoutRef.current = setTimeout(() => {
          setIsRefreshingBalances(false);
          setLoadingState({ type: 'idle' });
          refreshTimeoutRef.current = null;
        }, 500);
      }
    },
    isRefreshingBalances,
    loadingState
  };
}
