'use client';

import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
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

  const wagmiConfig = React.useMemo(() => {
    if (!appConfig) return null;
    return createDynamicConfig(appConfig.app);
  }, [appConfig]);

  // Show loading state
  if (isLoading || !currentChain) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
          <p>Loading app configuration...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !appConfig || !wagmiConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center text-red-600">
          <p>Failed to load app configuration</p>
          {error && <p className="mt-2 text-sm">{error.message}</p>}
          {!wagmiConfig && !error && <p className="mt-2 text-sm">No WalletConnect projectId configured</p>}
        </div>
      </div>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider
        theme={rainbowKitTheme}
        locale="en-US"
        appInfo={{ appName: appConfig.app.name }}
        initialChain={currentChain}
      >
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
