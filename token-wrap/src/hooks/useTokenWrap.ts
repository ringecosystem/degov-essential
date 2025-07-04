import { useState, useCallback, useEffect } from 'react';
import { toast } from 'react-toastify';
import { parseUnits, formatUnits, erc20Abi } from 'viem';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

import { abi as wrapAbi } from '@/config/abi/wrap';
import { getTokenConfig } from '@/utils/app-config';

export function useTokenWrap() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | undefined>();
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'confirming' | 'success' | 'error'>('idle');
  const [tokenConfig, setTokenConfig] = useState<{
    sourceToken: any;
    wrapToken: any;
    wrapContractAddress: `0x${string}`;
  } | null>(null);

  // Load token configuration
  useEffect(() => {
    getTokenConfig().then(setTokenConfig).catch(console.error);
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
    args: address ? [address, tokenConfig?.wrapContractAddress] : undefined,
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
        // 如果是找不到交易收据的错误，继续重试
        if (error?.message?.includes('could not be found')) {
          return failureCount < 10; // 最多重试10次
        }
        return failureCount < 3; // 其他错误重试3次
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // 指数退避，最大10秒
    }
  });

  // Update transaction status based on receipt
  useEffect(() => {
    if (!txHash) {
      setTxStatus('idle');
    } else if (isConfirming) {
      setTxStatus('confirming');
    } else if (isTransactionSuccess) {
      setTxStatus('success');
      // Auto refresh balances after successful transaction
      refetchFromTokenBalance();
      refetchToTokenBalance();
      refetchFromTokenAllowance();
      
      toast.success('Transaction confirmed successfully!', {
        onClose: () => {
          // Reset transaction state after toast is closed
          setTxHash(undefined);
          setTxStatus('idle');
        }
      });
    } else if (isTransactionError) {
      setTxStatus('error');
      
      // 根据错误类型提供更友好的错误信息
      let errorMessage = 'Transaction failed';
      if (transactionError?.message?.includes('could not be found')) {
        errorMessage = 'Transaction is taking longer than expected. Please check your wallet or block explorer.';
      } else if (transactionError?.message?.includes('User rejected')) {
        errorMessage = 'Transaction was rejected by user';
      } else if (transactionError?.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for transaction';
      } else if (transactionError?.message?.includes('gas')) {
        errorMessage = 'Transaction failed due to gas issues';
      } else if (transactionError?.message) {
        errorMessage = `Transaction failed: ${transactionError.message}`;
      }
      
      toast.error(errorMessage, {
        duration: 8000, // 错误消息显示更长时间
        onClose: () => {
          // 错误时也重置状态
          setTxHash(undefined);
          setTxStatus('idle');
        }
      });
    }
  }, [txHash, isConfirming, isTransactionSuccess, isTransactionError, transactionError, refetchFromTokenBalance, refetchToTokenBalance, refetchFromTokenAllowance]);

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
        const amountBigInt = parseUnits(amount, tokenConfig.sourceToken.decimals);

        toast.info('Please confirm the approval transaction in your wallet...');

        const hash = await writeContractAsync({
          address: tokenConfig.sourceToken.address,
          abi: erc20Abi,
          functionName: 'approve',
          args: [tokenConfig.wrapContractAddress, amountBigInt]
        });

        setTxHash(hash);
        setTxStatus('confirming');
        toast.success('Approval transaction submitted! Waiting for confirmation...');

        return hash;
      } catch (error) {
        console.error('Approve error:', error);
        setTxStatus('error');
        toast.error(`Failed to approve ${tokenConfig?.sourceToken.symbol}: ${error.message || 'Unknown error'}`);
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

      const amountBigInt = parseUnits(amount, tokenConfig.sourceToken.decimals);
      const allowanceBigInt = parseUnits(
        fromTokenAllowance.toString(),
        tokenConfig.sourceToken.decimals
      );

      return allowanceBigInt < amountBigInt;
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
        const amountBigInt = parseUnits(amount, tokenConfig.sourceToken.decimals);

        toast.info('Please confirm the wrap transaction in your wallet...');

        const hash = await writeContractAsync({
          address: tokenConfig.wrapContractAddress,
          abi: wrapAbi,
          functionName: 'depositFor',
          args: [address, amountBigInt]
        });

        setTxHash(hash);
        setTxStatus('confirming');
        toast.success('Wrap transaction submitted! Waiting for confirmation...');

        return hash;
      } catch (error) {
        console.error('Wrap error:', error);
        setTxStatus('error');
        toast.error(`Failed to wrap ${tokenConfig?.sourceToken.symbol}: ${error.message || 'Unknown error'}`);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [
      address,
      tokenConfig,
      needsApproval,
      writeContractAsync
    ]
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
        const amountBigInt = parseUnits(amount, tokenConfig.wrapToken.decimals);

        toast.info('Please confirm the unwrap transaction in your wallet...');

        const hash = await writeContractAsync({
          address: tokenConfig.wrapContractAddress,
          abi: wrapAbi,
          functionName: 'withdrawTo',
          args: [address, amountBigInt]
        });

        setTxHash(hash);
        setTxStatus('confirming');
        toast.success('Unwrap transaction submitted! Waiting for confirmation...');

        return hash;
      } catch (error) {
        console.error('Unwrap error:', error);
        setTxStatus('error');
        toast.error(`Failed to unwrap ${tokenConfig?.wrapToken.symbol}: ${error.message || 'Unknown error'}`);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [address, tokenConfig, writeContractAsync]
  );
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
    refetchBalances: () => {
      refetchFromTokenBalance();
      refetchToTokenBalance();
      refetchFromTokenAllowance();
    }
  };
}
