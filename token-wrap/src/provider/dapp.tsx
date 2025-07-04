'use client';

import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as React from 'react';
import { WagmiProvider, deserialize, serialize } from 'wagmi';
import { getChainById } from '@/utils/app-config';

import { createDynamicConfig, defaultConfig, queryClient } from '@/config/wagmi';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useRainbowKitTheme } from '@/hooks/useRainbowKitTheme';
import '@rainbow-me/rainbowkit/styles.css';

import type { Chain } from '@rainbow-me/rainbowkit';

const persister = createSyncStoragePersister({
  serialize,
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  deserialize,
});

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
      contracts: viemChain.contracts,
    };
  }, [appConfig]);

  const wagmiConfig = React.useMemo(() => {
    if (!appConfig) return defaultConfig;
    return createDynamicConfig(appConfig.app);
  }, [appConfig]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading app configuration...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !appConfig) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <p>Failed to load app configuration</p>
          <p className="text-sm mt-2">{error?.message}</p>
        </div>
      </div>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister }}
      >
        <RainbowKitProvider
          theme={rainbowKitTheme}
          locale="en-US"
          appInfo={{ appName: appConfig.app.name }}
          initialChain={currentChain}
        >
          {children}
        </RainbowKitProvider>
      </PersistQueryClientProvider>
    </WagmiProvider>
  );
}
