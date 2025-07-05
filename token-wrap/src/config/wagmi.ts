import { getDefaultWallets, getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  talismanWallet,
  okxWallet,
  imTokenWallet,
  trustWallet,
  safeWallet,
  subWallet
} from '@rainbow-me/rainbowkit/wallets';
import { QueryClient } from '@tanstack/react-query';
import { cookieStorage, createStorage } from 'wagmi';
import { mainnet } from 'wagmi/chains';

import type { AppConfig } from '@/types/config';
import { getChainById } from '@/utils/app-config';

import { APP_NAME } from './base';

import type { Chain } from 'viem';

const { wallets } = getDefaultWallets();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5_000
    }
  }
});

// Create dynamic wagmi config based on app configuration
export function createDynamicConfig(appConfig: AppConfig) {
  const appChain = getChainById(appConfig.chainId);
  
  // Always include mainnet as fallback, plus the app-specific chain if different
  const chains: readonly [Chain, ...Chain[]] = appChain && appChain.id !== mainnet.id
    ? [mainnet, appChain] as const
    : [mainnet] as const;

  return getDefaultConfig({
    appName: appConfig.name || APP_NAME,
    projectId: process.env.NEXT_PUBLIC_PROJECT_ID ?? '',
    wallets: [
      ...wallets,
      {
        groupName: 'More',
        wallets: [talismanWallet, subWallet, okxWallet, imTokenWallet, trustWallet, safeWallet]
      }
    ],
    chains,
    ssr: true,
    storage: createStorage({
      storage: cookieStorage
    })
  });
}

// Fallback config for development/SSR
export const defaultConfig = getDefaultConfig({
  appName: APP_NAME,
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID ?? '',
  wallets: [
    ...wallets,
    {
      groupName: 'More',
      wallets: [talismanWallet, subWallet, okxWallet, imTokenWallet, trustWallet, safeWallet]
    }
  ],
  chains: [mainnet],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage
  })
});
