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
export async function createDynamicConfig(appConfig: AppConfig) {
  let appChain = getChainById(appConfig.chainId);
  
  // If chain not found in viem, get it from app config
  if (!appChain) {
    try {
      appChain = await import('@/utils/app-config').then(module => module.getAppChain());
    } catch (error) {
      console.error('Failed to get app chain:', error);
      return null;
    }
  }
  
  // Always include mainnet as fallback, plus the app-specific chain if different
  const chains: readonly [Chain, ...Chain[]] = appChain && appChain.id !== mainnet.id
    ? [mainnet, appChain] as const
    : [mainnet] as const;

  // Return null if no projectId is configured
  if (!appConfig.wallet?.walletConnectProjectId) {
    return null;
  }

  return getDefaultConfig({
    appName: appConfig.name || APP_NAME,
    projectId: appConfig.wallet.walletConnectProjectId,
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

// Note: No default config - we only create config when projectId is available
