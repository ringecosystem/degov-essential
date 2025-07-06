'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2Icon } from 'lucide-react';
import Image from 'next/image';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';

import { ConnectButton } from '@/components/connect-button';
import { Button } from '@/components/ui/button';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useTokenWrap } from '@/hooks/useTokenWrap';
import { getChainById } from '@/utils/app-config';

import { SafeImage } from './safe-image';

type SwapMode = 'wrap' | 'unwrap';

interface ActionButtonProps {
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
  txStatus: string;
  isConfirming: boolean;
  buttonText: string;
  confirmingText: string;
}

function ActionButton({
  onClick,
  disabled,
  isLoading,
  txStatus,
  isConfirming,
  buttonText,
  confirmingText
}: ActionButtonProps) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Button onClick={onClick} disabled={disabled} className="w-full rounded-full">
        {isLoading && txStatus === 'pending' ? (
          <div className="flex items-center gap-2">
            <Loader2Icon className="size-[14px] animate-spin" />
            Confirming in wallet...
          </div>
        ) : isConfirming ? (
          <div className="flex items-center gap-2">
            <Loader2Icon className="size-[14px] animate-spin" />
            {confirmingText}
          </div>
        ) : (
          buttonText
        )}
      </Button>
    </motion.div>
  );
}

export function TokenSwap() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { config: appConfig } = useAppConfig();
  const [mode, setMode] = useState<SwapMode>('wrap');
  const [amount, setAmount] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

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

  const isWrongNetwork = chainId !== appConfig?.app.chainId;

  // Network connectivity monitoring
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    setIsOffline(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  // Input validation function
  const validateInput = useCallback((value: string): string | null => {
    if (!value) return null;

    // Check for valid number format
    if (!/^\d*\.?\d*$/.test(value)) {
      return 'Please enter a valid number';
    }

    // Check for negative numbers
    if (parseFloat(value) < 0) {
      return 'Amount cannot be negative';
    }

    // Check for too many decimal places
    const decimals = value.split('.')[1];
    if (decimals && decimals.length > 18) {
      return 'Too many decimal places (max 18)';
    }

    // Check for scientific notation
    if (value.toLowerCase().includes('e')) {
      return 'Scientific notation is not allowed';
    }

    return null;
  }, []);

  const handleAmountChange = useCallback(
    (value: string) => {
      // Allow empty input
      if (value === '') {
        setAmount('');
        setInputError(null);
        return;
      }

      // Validate input
      const error = validateInput(value);
      setInputError(error);

      // Only set amount if valid
      if (!error) {
        setAmount(value);
      }
    },
    [validateInput]
  );

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'wrap' ? 'unwrap' : 'wrap'));
    setAmount('');
    setInputError(null);
  }, []);

  const handleMaxClick = useCallback(() => {
    setAmount(fromBalance);
    setInputError(null);
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
      className="container mx-auto flex justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div className="flex w-full flex-col gap-[20px] md:w-[440px]">
        <div className="flex items-center justify-center gap-[20px]">
          <SafeImage src={sourceToken?.icon} alt={sourceToken?.symbol} width={60} height={60} />
          <h1 className="text-[36px] font-semibold">{sourceToken?.symbol || ''} Wrap</h1>
        </div>

        <div className="bg-card flex flex-col gap-[20px] rounded-[14px] p-[20px]">
          {/* Token Swap Interface */}
          <div className="relative flex flex-col gap-[2px]">
            {/* You pay */}
            <div className="bg-background flex flex-col gap-[10px] rounded-[10px] p-[10px]">
              <span className="text-muted-foreground text-[14px] font-normal">You pay</span>
              <div className="flex items-center gap-[10px]">
                <SafeImage src={fromToken?.icon} alt={fromToken?.symbol} width={30} height={30} />
                <span className="text-[16px] font-semibold">{fromToken?.symbol || ''}</span>
              </div>
            </div>

            {/* You receive */}
            <div className="bg-background flex flex-col gap-[10px] rounded-[10px] p-[10px]">
              <span className="text-muted-foreground text-[14px] font-normal">You receive</span>
              <div className="flex items-center gap-[10px]">
                <SafeImage src={toToken?.icon} alt={toToken?.symbol} width={30} height={30} />
                <span className="text-[16px] font-semibold">{toToken?.symbol || ''}</span>
              </div>
            </div>

            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:opacity-80"
              onClick={toggleMode}
            >
              <SafeImage src="/switch.svg" alt="swap" width={30} height={30} />
            </div>
          </div>

          {/* Amount Input Area */}
          <div className="bg-background flex flex-col gap-[10px] rounded-[10px] p-[10px]">
            <span className="text-muted-foreground text-[14px] font-normal">Amount</span>

            {/* Amount Input */}
            <input
              type="text"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              className="placeholder:text-muted-foreground w-full bg-transparent text-[26px] font-semibold outline-none"
              disabled={isLoading}
            />

            {/* Balance Display with Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[5px]">
                <span className="text-muted-foreground text-[14px] font-normal">
                  Balance: {formatBalance(fromBalance)}
                </span>
                <button
                  onClick={handleRefreshBalance}
                  className="bg-card flex size-[20px] cursor-pointer items-center justify-center rounded-full transition-colors hover:opacity-80 disabled:opacity-50"
                  disabled={isLoading || isRefreshingBalances}
                  title="Refresh balance"
                >
                  <Image
                    src="/reload.svg"
                    alt="refresh"
                    width={14}
                    height={14}
                    className={isRefreshingBalances ? 'animate-spin' : ''}
                  />
                </button>
                {fromBalance !== '0' && (
                  <button
                    onClick={handleMaxClick}
                    className="bg-card h-[20px] cursor-pointer rounded-[100px] px-[5px] py-[0px] text-[12px] font-semibold text-[rgba(255,255,255,0.5)] transition-colors hover:opacity-80 disabled:opacity-50"
                    disabled={isLoading}
                  >
                    Max
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Error Messages */}
          <AnimatePresence mode="wait">
            {inputError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-[5px]"
              >
                <SafeImage src="/alert.svg" alt="alert" width={20} height={20} />
                <span className="text-[12px] font-normal text-[#FF3546]">{inputError}</span>
              </motion.div>
            )}

            {isOffline && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-[5px]"
              >
                <SafeImage src="/alert.svg" alt="alert" width={20} height={20} />
                <span className="text-[12px] font-normal text-[#FF3546]">
                  No internet connection. Please check your network.
                </span>
              </motion.div>
            )}

            {isConnected && isWrongNetwork && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-[5px]"
              >
                <SafeImage src="/alert.svg" alt="alert" width={20} height={20} />
                <span className="text-[12px] font-normal text-[#FF3546]">
                  Wrong network, {mode} operation only supports {supportedNetworkName}
                </span>
              </motion.div>
            )}

            {hasInsufficientBalance && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-[5px]"
              >
                <SafeImage src="/alert.svg" alt="alert" width={20} height={20} />
                <span className="text-[12px] font-normal text-[#FF3546]">Insufficient balance</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Button */}
          {!isConnected ? (
            <ConnectButton />
          ) : isOffline || (isConnected && isWrongNetwork) || hasInsufficientBalance || inputError ? (
            <motion.div
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <Button disabled className="w-full rounded-full">
                {isOffline
                  ? 'No Internet Connection'
                  : isWrongNetwork
                    ? 'Switch Network'
                    : hasInsufficientBalance
                      ? 'Insufficient Balance'
                      : 'Invalid Input'}
              </Button>
            </motion.div>
          ) : needsApprovalCheck ? (
            <ActionButton
              onClick={handleApprove}
              disabled={!isAmountValid || isLoading}
              isLoading={isLoading}
              txStatus={txStatus}
              isConfirming={isConfirming}
              buttonText={`Approve ${fromToken?.symbol || 'Token'}`}
              confirmingText="Approving..."
            />
          ) : (
            <ActionButton
              onClick={handleSwap}
              disabled={!isAmountValid || isLoading}
              isLoading={isLoading}
              txStatus={txStatus}
              isConfirming={isConfirming}
              buttonText={mode === 'wrap' ? 'Wrap' : 'Unwrap'}
              confirmingText={mode === 'wrap' ? 'Wrapping...' : 'Unwrapping...'}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
