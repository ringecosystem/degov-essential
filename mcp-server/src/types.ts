export enum RuntimeProfile {
  Development = "development",
  Production = "production",
}

export class Resp<T> {
  code: number;
  message?: string;
  data?: T;
  additional?: any;

  constructor(code: number, message?: string, data?: T, additional?: any) {
    this.code = code;
    this.message = message;
    this.data = data;
    this.additional = additional;
  }

  static create<J>(code: number, message: string, data: J): Resp<J> {
    return new Resp(code, message, data, undefined);
  }

  static ok<J>(data: J, additional?: any): Resp<J> {
    return new Resp(0, undefined, data, additional);
  }

  static err(message: string): Resp<undefined> {
    return new Resp(1, message, undefined, undefined);
  }

  static errWithData<J>(message: string, data: J): Resp<J> {
    return new Resp(1, message, data, undefined);
  }
}

export interface TwitterAuthorizeForm {
  profile: string;
  method: "api";
}

export interface TwitterOAuthType {
  oauth_token: string;
  oauth_token_secret: string;
}

export interface QueryTwitterCallback {
  profile: string;
  oauth_token: string;
  oauth_verifier: string;
}

export interface DegovDaoConfig {
  name: string;
  xprofile?: string;
  links: DegovMcpDaoUrl;
}

export interface DegovMcpDaoUrl {
  website: string;
  config: string;
  indexer: string;
}

export interface DegovMcpDao extends DegovDaoConfig {
  config?: DegovConfig;
  lastProcessedBlock?: number; // The last processed block by the indexer
}

export interface DegovConfigIndexerConfig {
  endpoint: string; // GraphQL endpoint for the indexer
  startBlock: number; // The block number from which the indexer starts
  rpc: string; // WebSocket RPC URL for blockchain communication
}

export interface DegovConfigContractConfig {
  governor: string; // Address of the governor contract
  governorToken: {
    address: string; // Address of the governor token contract
    standard: "ERC20" | "ERC721"; // Token standard
  };
  timeLock: string; // Address of the time lock contract
}

export interface DegovConfigTimeLockAsset {
  name: string; // Name of the asset
  contract: string; // Contract address of the asset
  standard: "ERC20" | "ERC721"; // Token standard
  priceId: string; // Price identifier for the asset
  logo: string | null; // Logo URL or null
}

export interface DegovConfigSafeConfig {
  name: string; // Name of the safe
  chainId: number; // Chain ID of the blockchain
  link: string; // URL link to the safe
}

export interface DegovConfigChain {
  name: string; // Name of the blockchain
  rpcs: string[]; // List of RPC URLs
  explorers: string[]; // List of blockchain explorer URLs
  contracts: {
    multicall3: {
      address: string; // Address of the multicall3 contract
      blockCreated: number; // Block number when the contract was created
    };
  };
  nativeToken: {
    priceId: string; // Price identifier for the native token
    logo?: string; // Optional logo URL for the native token
    symbol: string; // Symbol of the native token
    decimals: number; // Number of decimals for the native token
  };
  id: number; // Chain ID of the blockchain
  logo: string; // Logo URL of the blockchain
}

export interface DegovConfig {
  name: string; // Name of the DAO
  logo: string; // Logo URL of the DAO
  siteUrl: string; // Website URL of the DAO
  offChainDiscussionUrl?: string; // Optional URL for off-chain discussions
  description?: string; // Optional description of the DAO
  links?: {
    website?: string;
    twitter?: string;
    discord?: string;
    telegram?: string;
    github?: string;
    email?: string;
  };
  wallet?: {
    walletConnectProjectId?: string; // WalletConnect project ID
  };
  chain: DegovConfigChain;
  indexer: DegovConfigIndexerConfig; // Indexer configuration
  contracts: DegovConfigContractConfig; // Contracts configuration
  timeLockAssets: DegovConfigTimeLockAsset[]; // List of time lock assets
  safes: DegovConfigSafeConfig[]; // List of safes
}
