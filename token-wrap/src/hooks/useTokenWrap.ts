import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { parseUnits, formatUnits, erc20Abi } from 'viem';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

import { abi as wrapAbi } from '@/config/abi/wrap';
import { TOKEN_ADDRESSES, TOKEN_INFO } from '@/config/tokens';

export function useTokenWrap() {
  const { address, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | undefined>();

  // Read FROM_TOKEN balance
  const { data: fromTokenBalance, refetch: refetchFromTokenBalance } = useReadContract({
    address: TOKEN_ADDRESSES.FROM_TOKEN,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address
    }
  });

  // Read TO_TOKEN balance
  const { data: toTokenBalance, refetch: refetchToTokenBalance } = useReadContract({
    address: TOKEN_ADDRESSES.TO_TOKEN,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address
    }
  });

  // Read FROM_TOKEN allowance for TO_TOKEN contract
  const { data: fromTokenAllowance, refetch: refetchFromTokenAllowance } = useReadContract({
    address: TOKEN_ADDRESSES.FROM_TOKEN,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, TOKEN_ADDRESSES.TO_TOKEN] : undefined,
    query: {
      enabled: !!address
    }
  });

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}`
  });

  // Approve FROM_TOKEN for wrapping
  const approveFromToken = useCallback(
    async (amount: string) => {
      if (!address) {
        toast.error('Please connect your wallet');
        return;
      }

      try {
        setIsLoading(true);
        const amountBigInt = parseUnits(amount, TOKEN_INFO.FROM_TOKEN.decimals);

        const hash = await writeContractAsync({
          address: TOKEN_ADDRESSES.FROM_TOKEN,
          abi: erc20Abi,
          functionName: 'approve',
          args: [TOKEN_ADDRESSES.TO_TOKEN, amountBigInt]
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
        toast.error(`Failed to approve ${TOKEN_INFO.FROM_TOKEN.symbol}`);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [address, writeContractAsync, refetchFromTokenAllowance]
  );

  // Check if approval is needed before wrapping
  const needsApproval = useCallback(
    (amount: string): boolean => {
      if (!fromTokenAllowance) {
        return true;
      }

      const amountBigInt = parseUnits(amount, TOKEN_INFO.FROM_TOKEN.decimals);
      const allowanceBigInt = parseUnits(
        fromTokenAllowance.toString(),
        TOKEN_INFO.FROM_TOKEN.decimals
      );

      return allowanceBigInt < amountBigInt;
    },
    [fromTokenAllowance]
  );

  // Wrap FROM_TOKEN to TO_TOKEN
  const wrapToken = useCallback(
    async (amount: string) => {
      if (!address) {
        toast.error('Please connect your wallet');
        return;
      }

      // Check if approval is needed first
      if (needsApproval(amount)) {
        toast.error(`Please approve ${TOKEN_INFO.FROM_TOKEN.symbol} first`);
        return;
      }

      try {
        setIsLoading(true);
        const amountBigInt = parseUnits(amount, TOKEN_INFO.FROM_TOKEN.decimals);

        const hash = await writeContractAsync({
          address: TOKEN_ADDRESSES.TO_TOKEN,
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
        toast.error(`Failed to wrap ${TOKEN_INFO.FROM_TOKEN.symbol}`);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [
      address,
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
      if (!address) {
        toast.error('Please connect your wallet');
        return;
      }

      try {
        setIsLoading(true);
        const amountBigInt = parseUnits(amount, TOKEN_INFO.TO_TOKEN.decimals);

        const hash = await writeContractAsync({
          address: TOKEN_ADDRESSES.TO_TOKEN,
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
        toast.error(`Failed to unwrap ${TOKEN_INFO.TO_TOKEN.symbol}`);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [address, writeContractAsync, refetchFromTokenBalance, refetchToTokenBalance]
  );
  console.log('fromTokenBalance', fromTokenBalance, TOKEN_INFO.FROM_TOKEN.decimals);

  return {
    // Balances
    fromTokenBalance: fromTokenBalance
      ? formatUnits(fromTokenBalance, TOKEN_INFO.FROM_TOKEN.decimals)
      : '0',
    toTokenBalance: toTokenBalance
      ? formatUnits(toTokenBalance, TOKEN_INFO.TO_TOKEN.decimals)
      : '0',
    fromTokenAllowance: fromTokenAllowance
      ? formatUnits(fromTokenAllowance, TOKEN_INFO.FROM_TOKEN.decimals)
      : '0',

    // Actions
    approveFromToken,
    wrapToken,
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
