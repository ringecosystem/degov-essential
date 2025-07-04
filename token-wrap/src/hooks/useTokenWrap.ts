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

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}`
  });

  // Approve FROM_TOKEN for wrapping
  const approveFromToken = useCallback(
    async (amount: string) => {
      if (!address || !tokenConfig) {
        toast.error('Please connect your wallet');
        return;
      }

      try {
        setIsLoading(true);
        const amountBigInt = parseUnits(amount, tokenConfig.sourceToken.decimals);

        const hash = await writeContractAsync({
          address: tokenConfig.sourceToken.address,
          abi: erc20Abi,
          functionName: 'approve',
          args: [tokenConfig.wrapContractAddress, amountBigInt]
        });

        setTxHash(hash);
        toast.success('Approval transaction submitted');

        // Refetch allowance after approval
        setTimeout(() => {
          refetchFromTokenAllowance();
        }, 2000);

        return hash;
      } catch (error) {
        console.error('Approve error:', error);
        toast.error(`Failed to approve ${tokenConfig?.sourceToken.symbol}`);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [address, tokenConfig, writeContractAsync, refetchFromTokenAllowance]
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
        const amountBigInt = parseUnits(amount, tokenConfig.sourceToken.decimals);

        const hash = await writeContractAsync({
          address: tokenConfig.wrapContractAddress,
          abi: wrapAbi,
          functionName: 'depositFor',
          args: [address, amountBigInt]
        });

        setTxHash(hash);
        toast.success('Wrap transaction submitted');

        // Refetch balances after transaction
        setTimeout(() => {
          refetchFromTokenBalance();
          refetchToTokenBalance();
          refetchFromTokenAllowance();
        }, 2000);

        return hash;
      } catch (error) {
        console.error('Wrap error:', error);
        toast.error(`Failed to wrap ${tokenConfig?.sourceToken.symbol}`);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [
      address,
      tokenConfig,
      needsApproval,
      writeContractAsync,
      refetchFromTokenBalance,
      refetchToTokenBalance,
      refetchFromTokenAllowance
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
        const amountBigInt = parseUnits(amount, tokenConfig.wrapToken.decimals);

        const hash = await writeContractAsync({
          address: tokenConfig.wrapContractAddress,
          abi: wrapAbi,
          functionName: 'withdrawTo',
          args: [address, amountBigInt]
        });

        setTxHash(hash);
        toast.success('Unwrap transaction submitted');

        // Refetch balances after transaction
        setTimeout(() => {
          refetchFromTokenBalance();
          refetchToTokenBalance();
        }, 2000);

        return hash;
      } catch (error) {
        console.error('Unwrap error:', error);
        toast.error(`Failed to unwrap ${tokenConfig?.wrapToken.symbol}`);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [address, tokenConfig, writeContractAsync, refetchFromTokenBalance, refetchToTokenBalance]
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

    // Refetch functions
    refetchBalances: () => {
      refetchFromTokenBalance();
      refetchToTokenBalance();
      refetchFromTokenAllowance();
    }
  };
}
