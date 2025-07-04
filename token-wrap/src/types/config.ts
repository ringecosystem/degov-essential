export interface TokenConfig {
  symbol: string;
  decimals: number;
  address: `0x${string}`;
  icon: string;
}

export interface AppConfig {
  name: string;
  logo: string;
  description?: string;
  chainId: number;
  sourceToken: TokenConfig;
  wrapToken: TokenConfig;
  wrapContractAddress: `0x${string}`;
}

export interface Config {
  app: AppConfig;
}
