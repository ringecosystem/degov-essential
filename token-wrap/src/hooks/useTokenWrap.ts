import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { parseUnits, formatUnits } from 'viem';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { erc20Abi, erc721Abi } from 'viem';

import { abi as wrapAbi } from '@/config/abi/wrap';
import { TOKEN_ADDRESSES, TOKEN_INFO, TokenStandard } from '@/config/tokens';

export function useTokenWrap() {
  const { address, chainId } = useAccount();
  console.log('chainId', chainId);
  const { writeContractAsync } = useWriteContract();
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | undefined>();

  // Read FROM_TOKEN balance
  const {
    data: fromTokenBalance,
    refetch: refetchFromTokenBalance,
    isLoading: isFromTokenBalanceLoading
  } = useReadContract({
    address: '0x48C817eebE1fD79F946bd6b976EF579540517121',
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: ['0x3d6d656c1bf92f7028Ce4C352563E1C363C58ED5'],
    chainId: 46
  });
  console.log('fromTokenBalance', address, fromTokenBalance, isFromTokenBalanceLoading);

  // Read TO_TOKEN balance
  const { data: toTokenBalance, refetch: refetchToTokenBalance } = useReadContract({
    address: TOKEN_ADDRESSES.TO_TOKEN,
    abi: TOKEN_INFO.TO_TOKEN.standard === TokenStandard.ERC721 ? erc721Abi : erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address
    }
  });

  // Read FROM_TOKEN allowance for TO_TOKEN contract (only for ERC20)
  const { data: fromTokenAllowance, refetch: refetchFromTokenAllowance } = useReadContract({
    address: TOKEN_ADDRESSES.FROM_TOKEN,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, TOKEN_ADDRESSES.TO_TOKEN] : undefined,
    query: {
      enabled: !!address && TOKEN_INFO.FROM_TOKEN.standard === TokenStandard.ERC20
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
        const amountBigInt =
          TOKEN_INFO.FROM_TOKEN.standard === TokenStandard.ERC721
            ? BigInt(amount) // For ERC721, amount is token ID
            : parseUnits(amount, TOKEN_INFO.FROM_TOKEN.decimals);

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
      if (TOKEN_INFO.FROM_TOKEN.standard === TokenStandard.ERC721) {
        return false; // ERC721 doesn't need allowance check
      }
      
      if (!fromTokenAllowance) {
        return true;
      }

      const amountBigInt = parseUnits(amount, TOKEN_INFO.FROM_TOKEN.decimals);
      const allowanceBigInt = parseUnits(fromTokenAllowance, TOKEN_INFO.FROM_TOKEN.decimals);
      
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
        const amountBigInt =
          TOKEN_INFO.FROM_TOKEN.standard === TokenStandard.ERC721
            ? BigInt(amount) // For ERC721, amount is token ID
            : parseUnits(amount, TOKEN_INFO.FROM_TOKEN.decimals);

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
        const amountBigInt =
          TOKEN_INFO.TO_TOKEN.standard === TokenStandard.ERC721
            ? BigInt(amount) // For ERC721, amount is token ID
            : parseUnits(amount, TOKEN_INFO.TO_TOKEN.decimals);

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

  return {
    // Balances
    fromTokenBalance: fromTokenBalance
      ? TOKEN_INFO.FROM_TOKEN.standard === TokenStandard.ERC721
        ? fromTokenBalance.toString()
        : formatUnits(fromTokenBalance, TOKEN_INFO.FROM_TOKEN.decimals)
      : '0',
    toTokenBalance: toTokenBalance
      ? TOKEN_INFO.TO_TOKEN.standard === TokenStandard.ERC721
        ? toTokenBalance.toString()
        : formatUnits(toTokenBalance, TOKEN_INFO.TO_TOKEN.decimals)
      : '0',
    fromTokenAllowance:
      fromTokenAllowance && TOKEN_INFO.FROM_TOKEN.standard === TokenStandard.ERC20
        ? formatUnits(fromTokenAllowance, TOKEN_INFO.FROM_TOKEN.decimals)
        : '0',

    // Token standards
    fromTokenStandard: TOKEN_INFO.FROM_TOKEN.standard,
    toTokenStandard: TOKEN_INFO.TO_TOKEN.standard,

    // Actions
    approveFromToken,
    wrapToken,
    unwrapToken,

    // States
    isLoading: isLoading || isConfirming,
    txHash,

    // Refetch functions
    refetchBalances: () => {
      refetchFromTokenBalance();
      refetchToTokenBalance();
      if (TOKEN_INFO.FROM_TOKEN.standard === TokenStandard.ERC20) {
        refetchFromTokenAllowance();
      }
    }
  };
}
