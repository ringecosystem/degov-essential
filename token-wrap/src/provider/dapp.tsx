'use client';

import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import Image from 'next/image';
import * as React from 'react';
import { WagmiProvider } from 'wagmi';

import { createDynamicConfig } from '@/config/wagmi';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useRainbowKitTheme } from '@/hooks/useRainbowKitTheme';
import { getChainById } from '@/utils/app-config';

import type { Chain } from '@rainbow-me/rainbowkit';

import '@rainbow-me/rainbowkit/styles.css';

export function DAppProvider({ children }: React.PropsWithChildren<unknown>) {
  const { config: appConfig, isLoading, error } = useAppConfig();
  const rainbowKitTheme = useRainbowKitTheme();

  const currentChain: Chain | null = React.useMemo(() => {
    if (!appConfig) return null;

    const viemChain = getChainById(appConfig.app.chainId);
    if (!viemChain) return null;

    return {
      id: viemChain.id,
      name: viemChain.name,
      nativeCurrency: viemChain.nativeCurrency,
      rpcUrls: viemChain.rpcUrls,
      blockExplorers: viemChain.blockExplorers,
      contracts: viemChain.contracts
    };
  }, [appConfig]);

  const [wagmiConfig, setWagmiConfig] = React.useState<any>(null);

  React.useEffect(() => {
    if (!appConfig) {
      setWagmiConfig(null);
      return;
    }

    const loadWagmiConfig = async () => {
      try {
        const config = await createDynamicConfig(appConfig.app);
        setWagmiConfig(config);
      } catch (error) {
        console.error('Failed to create wagmi config:', error);
        setWagmiConfig(null);
      }
    };

    loadWagmiConfig();
  }, [appConfig]);

  // Show loading state - only when actually loading, not when there's an error
  if (isLoading && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex items-center justify-center gap-[10px] animate-pulse">
            <p>Loading app configuration...</p>
            <Image
              src="/reload.svg"
              alt="loading"
              width={16}
              height={16}
              className="animate-spin"
            />
          </div>
        </div>
      </div>
    );
  }

  // Show loading state for wagmi config after app config is loaded
  if (!isLoading && appConfig && !error && (!currentChain || !wagmiConfig)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex items-center justify-center gap-[10px] animate-pulse">
            <p>Setting up wallet configuration...</p>
            <Image
              src="/reload.svg"
              alt="loading"
              width={16}
              height={16}
              className="animate-spin"
            />
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || (!isLoading && !appConfig) || (!isLoading && appConfig && !wagmiConfig)) {
    const handleRetry = () => {
      window.location.reload();
    };

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="bg-card max-w-md rounded-[14px] p-[20px] text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center">
            <Image 
              src="/alert.svg" 
              alt="error" 
              width={48} 
              height={48} 
              className="text-red-500"
            />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-red-600">Configuration Error</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Failed to load app configuration. Please check your network connection and try again.
          </p>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-red-700 text-xs font-mono break-words">{error.message}</p>
            </div>
          )}
          {!wagmiConfig && !error && (
            <p className="text-muted-foreground mb-4 text-xs">No WalletConnect projectId configured</p>
          )}
          <button
            onClick={handleRetry}
            className="bg-primary cursor-pointer text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider
        theme={rainbowKitTheme}
        locale="en-US"
        appInfo={{ appName: appConfig?.app?.name || 'App' }}
        initialChain={currentChain || undefined}
      >
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
