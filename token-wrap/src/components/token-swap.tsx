'use client';

import Image from 'next/image';
import { useState, useCallback, useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { mainnet } from 'wagmi/chains';

import { ConnectButton } from '@/components/connect-button';
import { Button } from '@/components/ui/button';
import { TOKEN_INFO } from '@/config/tokens';
import { useTokenWrap } from '@/hooks/useTokenWrap';

type SwapMode = 'wrap' | 'unwrap';

export function TokenSwap() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [mode, setMode] = useState<SwapMode>('wrap');
  const [amount, setAmount] = useState('');

  const {
    fromTokenBalance,
    toTokenBalance,
    approveFromToken,
    wrapToken,
    unwrapToken,
    needsApproval,
    isLoading,
    refetchBalances
  } = useTokenWrap();

  const isWrongNetwork = chainId !== mainnet.id;

  const fromToken = mode === 'wrap' ? TOKEN_INFO.FROM_TOKEN : TOKEN_INFO.TO_TOKEN;
  const toToken = mode === 'wrap' ? TOKEN_INFO.TO_TOKEN : TOKEN_INFO.FROM_TOKEN;
  const fromBalance = mode === 'wrap' ? fromTokenBalance : toTokenBalance;

  const needsApprovalCheck = useMemo(() => {
    if (mode !== 'wrap' || !amount) return false;
    return needsApproval(amount);
  }, [mode, amount, needsApproval]);

  const isAmountValid = useMemo(() => {
    if (!amount) return false;
    const amountNum = parseFloat(amount);
    const balanceNum = parseFloat(fromBalance);
    return amountNum > 0 && amountNum <= balanceNum;
  }, [amount, fromBalance]);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'wrap' ? 'unwrap' : 'wrap'));
    setAmount('');
  }, []);

  const handleMaxClick = useCallback(() => {
    setAmount(fromBalance);
  }, [fromBalance]);

  const handleRefreshBalance = useCallback(() => {
    refetchBalances();
  }, [refetchBalances]);

  const handleApprove = useCallback(async () => {
    if (!amount) return;
    try {
      await approveFromToken(amount);
    } catch (error) {
      console.error('Approve failed:', error);
    }
  }, [amount, approveFromToken]);

  const handleSwap = useCallback(async () => {
    if (!amount || !isAmountValid) return;

    try {
      if (mode === 'wrap') {
        await wrapToken(amount);
      } else {
        await unwrapToken(amount);
      }
      setAmount('');
      refetchBalances();
    } catch (error) {
      console.error('Swap failed:', error);
    }
  }, [amount, isAmountValid, mode, wrapToken, unwrapToken, refetchBalances]);

  const formatBalance = (balance: string) => {
    if (!balance || balance === '0') return '0';
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.0001) return '< 0.0001';
    return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="bg-card rounded-2xl border p-6 shadow-lg">
        {/* Header */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
            <Image src={TOKEN_INFO.FROM_TOKEN.icon} alt={TOKEN_INFO.FROM_TOKEN.symbol} width={24} height={24} />
          </div>
          <h1 className="text-2xl font-bold">{TOKEN_INFO.FROM_TOKEN.symbol} Token Wrap</h1>
        </div>

        {/* Token Swap Interface */}
        <div className="mb-4 space-y-2">
          {/* You pay */}
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="mb-2">
              <span className="text-muted-foreground text-sm">You pay</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Image src={fromToken.icon} alt={fromToken.symbol} width={32} height={32} />
                <span className="text-lg font-semibold">{fromToken.symbol}</span>
              </div>
            </div>
          </div>

          {/* Swap Arrow */}
          <div className="flex justify-center py-2">
            <button
              onClick={toggleMode}
              className="bg-background hover:bg-muted border-background flex h-10 w-10 items-center justify-center rounded-full border-4 transition-colors"
              disabled={isLoading}
            >
              <Image src="/arrow-down.svg" alt="swap" width={16} height={16} />
            </button>
          </div>

          {/* You receive */}
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="mb-2">
              <span className="text-muted-foreground text-sm">You receive</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Image src={toToken.icon} alt={toToken.symbol} width={32} height={32} />
                <span className="text-lg font-semibold">{toToken.symbol}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Amount Input Area */}
        <div className="bg-muted/50 mb-6 rounded-xl p-4">
          <div className="mb-2">
            <span className="text-muted-foreground text-sm">Amount</span>
          </div>

          {/* Amount Input */}
          <div className="mb-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="placeholder:text-muted-foreground w-full bg-transparent text-3xl font-bold outline-none"
              disabled={isLoading}
            />
          </div>

          {/* Balance Display with Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                Balance: {formatBalance(fromBalance)}
              </span>
              <button
                onClick={handleRefreshBalance}
                className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded-full transition-colors"
                disabled={isLoading}
                title="Refresh balance"
              >
                <Image src="/arrow-full.svg" alt="refresh" width={12} height={12} />
              </button>
            </div>

            {fromBalance !== '0' && (
              <button
                onClick={handleMaxClick}
                className="bg-muted hover:bg-muted/80 rounded-full px-3 py-1 text-xs font-medium transition-colors"
                disabled={isLoading}
              >
                Max
              </button>
            )}
          </div>
        </div>

        {/* Error Messages */}
        {isWrongNetwork && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-red-500">
            <Image src="/alert.svg" alt="alert" width={16} height={16} />
            <span className="text-sm">Wrong network, wrap operation only supports Ethereum</span>
          </div>
        )}

        {/* Action Button */}
        {!isConnected ? (
          <ConnectButton />
        ) : isWrongNetwork ? (
          <Button disabled className="w-full rounded-full">
            Switch to Ethereum
          </Button>
        ) : needsApprovalCheck ? (
          <Button
            onClick={handleApprove}
            disabled={!isAmountValid || isLoading}
            className="w-full rounded-full"
          >
            {isLoading ? 'Approving...' : `Approve ${fromToken.symbol}`}
          </Button>
        ) : (
          <Button
            onClick={handleSwap}
            disabled={!isAmountValid || isLoading}
            className="w-full rounded-full"
          >
            {isLoading
              ? `${mode === 'wrap' ? 'Wrapping' : 'Unwrapping'}...`
              : mode === 'wrap'
                ? 'Wrap'
                : 'Unwrap'}
          </Button>
        )}

        {/* Additional Info */}
        {amount && isAmountValid && (
          <div className="text-muted-foreground mt-4 text-center text-sm">
            1 {fromToken.symbol} = 1 {toToken.symbol}
          </div>
        )}
      </div>
    </div>
  );
}
