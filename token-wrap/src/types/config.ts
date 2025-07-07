export interface TokenConfig {
  symbol: string;
  decimals: number;
  address: `0x${string}`;
  icon: string;
}

export interface WalletConfig {
  walletConnectProjectId: string;
}

export interface ChainConfig {
  name: string;
  rpcs: string[];
  explorers: string[];
  contracts: {
    multicall3: {
      address: `0x${string}`;
      blockCreated: number;
    };
  };
  nativeToken: {
    priceId: string;
    logo: string | null;
    symbol: string;
    decimals: number;
  };
  id: number;
  logo: string;
}

export interface AppTokenParams {
  address: `0x${string}`;
  icon: string;
}

export interface AppItem {
  name: string;
  description: string;
  icon: string;
  link: string;
  params: {
    sourceToken: AppTokenParams;
    wrapToken: AppTokenParams;
  };
}

export interface DeGovConfig {
  name: string;
  logo: string;
  siteUrl: string;
  offChainDiscussionUrl: string;
  aiAgent: {
    endpoint: string;
  };
  description: string;
  links: {
    website: string;
    twitter: string;
    discord: string;
    telegram: string;
    github: string;
    email: string | null;
  };
  wallet: WalletConfig;
  chain: ChainConfig;
  apps: AppItem[];
}

export interface AppConfig {
  name: string;
  logo: string;
  description?: string;
  chainId: number;
  wallet?: WalletConfig;
  sourceToken: TokenConfig;
  wrapToken: TokenConfig;
  wrapContractAddress: `0x${string}`;
}

export interface Config {
  app: AppConfig;
}
