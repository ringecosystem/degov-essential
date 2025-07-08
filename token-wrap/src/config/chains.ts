import { darwinia } from 'wagmi/chains';

import type { Chain } from 'wagmi/chains';

export const supportedChains = [darwinia];

export const supportedChainsById = supportedChains.reduce(
  (acc, chain) => {
    acc[chain.id] = chain;
    return acc;
  },
  {} as Record<number, Chain>
);
