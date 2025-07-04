'use client';

import Image from 'next/image';
import { useState, useCallback, useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';

import { ConnectButton } from '@/components/connect-button';
import { Button } from '@/components/ui/button';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useTokenWrap } from '@/hooks/useTokenWrap';
import { getChainById } from '@/utils/app-config';

type SwapMode = 'wrap' | 'unwrap';

export function TokenSwap() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { config: appConfig } = useAppConfig();
  const [mode, setMode] = useState<SwapMode>('wrap');
  const [amount, setAmount] = useState('');

  const {
    fromTokenBalance,
    toTokenBalance,
    sourceToken,
    wrapToken,
    approveFromToken,
    wrap,
    unwrapToken,
    needsApproval,
    isLoading,
    txStatus,
    isConfirming,
    refetchBalances,
    isRefreshingBalances
  } = useTokenWrap();

  const fromToken = mode === 'wrap' ? sourceToken : wrapToken;
  const toToken = mode === 'wrap' ? wrapToken : sourceToken;
  const fromBalance = mode === 'wrap' ? fromTokenBalance : toTokenBalance;

  // 调试信息
  console.log('Token Swap Debug:', {
    mode,
    fromTokenBalance,
    toTokenBalance,
    fromBalance,
    sourceToken: sourceToken?.symbol,
    wrapToken: wrapToken?.symbol
  });

  const isWrongNetwork = chainId !== appConfig?.app.chainId;
  
  const supportedNetworkName = useMemo(() => {
    if (appConfig?.app.chainId) {
      const chain = getChainById(appConfig.app.chainId);
      return chain?.name || 'Unknown Network';
    }
    return 'Unknown Network';
  }, [appConfig]);

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

  const hasInsufficientBalance = useMemo(() => {
    if (!amount) return false;
    const amountNum = parseFloat(amount);
    const balanceNum = parseFloat(fromBalance);
    return amountNum > 0 && amountNum > balanceNum;
  }, [amount, fromBalance]);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'wrap' ? 'unwrap' : 'wrap'));
    setAmount('');
  }, []);

  const handleMaxClick = useCallback(() => {
    setAmount(fromBalance);
  }, [fromBalance]);

  const handleRefreshBalance = useCallback(async () => {
    await refetchBalances();
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
        await wrap(amount);
      } else {
        await unwrapToken(amount);
      }
      setAmount('');
      refetchBalances();
    } catch (error) {
      console.error('Swap failed:', error);
    }
  }, [amount, isAmountValid, mode, wrap, unwrapToken, refetchBalances]);

  const formatBalance = (balance: string) => {
    if (!balance || balance === '0') return '0';
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.0001) return '< 0.0001';
    return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
  };

  return (
    <motion.div 
      className="mx-auto max-w-md"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div 
        className="bg-card rounded-2xl border p-6 shadow-lg"
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
            <Image
              src={sourceToken?.icon || '/example/token.svg'}
              alt={sourceToken?.symbol || 'Token'}
              width={24}
              height={24}
            />
          </div>
          <h1 className="text-2xl font-bold">{sourceToken?.symbol || 'Token'} Wrap</h1>
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
                <Image src={fromToken?.icon || '/example/token.svg'} alt={fromToken?.symbol || 'Token'} width={32} height={32} />
                <span className="text-lg font-semibold">{fromToken?.symbol || 'Token'}</span>
              </div>
            </div>
          </div>

          {/* Swap Arrow */}
          <div className="flex justify-center py-2">
            <motion.button
              onClick={toggleMode}
              className="bg-background hover:bg-muted border-background flex h-10 w-10 items-center justify-center rounded-full border-4 transition-colors"
              disabled={isLoading}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              animate={{ rotate: mode === 'wrap' ? 0 : 180 }}
              transition={{ duration: 0.3 }}
            >
              <Image src="/arrow-down.svg" alt="swap" width={16} height={16} />
            </motion.button>
          </div>

          {/* You receive */}
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="mb-2">
              <span className="text-muted-foreground text-sm">You receive</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Image src={toToken?.icon || '/example/token.svg'} alt={toToken?.symbol || 'Token'} width={32} height={32} />
                <span className="text-lg font-semibold">{toToken?.symbol || 'Token'}</span>
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
                className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded-full transition-colors disabled:opacity-50"
                disabled={isLoading || isRefreshingBalances}
                title="Refresh balance"
              >
                {isRefreshingBalances ? (
                  <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent"></div>
                ) : (
                  <Image src="/arrow-full.svg" alt="refresh" width={12} height={12} />
                )}
              </button>
            </div>

            {fromBalance !== '0' && (
              <button
                onClick={handleMaxClick}
                className="bg-muted hover:bg-muted/80 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
                disabled={isLoading}
              >
                Max
              </button>
            )}
          </div>
        </div>

        {/* Transaction Status */}
        <AnimatePresence mode="wait">
          {isConfirming && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-4 flex items-center gap-2 rounded-lg bg-blue-500/10 p-3 text-blue-600"
            >
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Transaction confirming...</span>
                <span className="text-xs opacity-75">This may take a few minutes depending on network congestion</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Messages */}
        <AnimatePresence mode="wait">
          {isWrongNetwork && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-red-500"
            >
              <Image src="/alert.svg" alt="alert" width={16} height={16} />
              <span className="text-sm">Wrong network, {mode} operation only supports {supportedNetworkName}</span>
            </motion.div>
          )}

          {hasInsufficientBalance && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-red-500"
            >
              <Image src="/alert.svg" alt="alert" width={16} height={16} />
              <span className="text-sm">Insufficient balance</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Button */}
        {!isConnected ? (
          <ConnectButton />
        ) : isWrongNetwork || hasInsufficientBalance ? (
          <motion.div
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <Button disabled className="w-full rounded-full">
              {isWrongNetwork ? 'Switch Network' : 'Insufficient Balance'}
            </Button>
          </motion.div>
        ) : needsApprovalCheck ? (
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              onClick={handleApprove}
              disabled={!isAmountValid || isLoading}
              className="w-full rounded-full"
            >
            {isLoading && txStatus === 'pending' ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Confirming in wallet...
              </div>
            ) : isConfirming ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Approving...
              </div>
            ) : (
              `Approve ${fromToken?.symbol || 'Token'}`
            )}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              onClick={handleSwap}
              disabled={!isAmountValid || isLoading}
              className="w-full rounded-full"
            >
            {isLoading && txStatus === 'pending' ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Confirming in wallet...
              </div>
            ) : isConfirming ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                {mode === 'wrap' ? 'Wrapping...' : 'Unwrapping...'}
              </div>
            ) : (
              mode === 'wrap' ? 'Wrap' : 'Unwrap'
            )}
            </Button>
          </motion.div>
        )}

        {/* Additional Info */}
        <AnimatePresence>
          {amount && isAmountValid && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3 }}
              className="text-muted-foreground mt-4 text-center text-sm"
            >
              1 {fromToken?.symbol || 'Token'} = 1 {toToken?.symbol || 'Token'}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
