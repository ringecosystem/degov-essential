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
import { mainnet, darwinia } from 'wagmi/chains';

import { APP_NAME } from './base';

const { wallets } = getDefaultWallets();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5_000
    }
  }
});

export const config = getDefaultConfig({
  appName: APP_NAME,
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID ?? '',
  wallets: [
    ...wallets,
    {
      groupName: 'More',
      wallets: [talismanWallet, subWallet, okxWallet, imTokenWallet, trustWallet, safeWallet]
    }
  ],
  chains: [mainnet, darwinia],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage
  })
});

export const defaultChain = darwinia;
export const defaultChainId = darwinia.id;
