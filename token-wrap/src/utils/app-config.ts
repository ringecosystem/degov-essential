import { load } from 'js-yaml';
import { createPublicClient, http } from 'viem';
import * as allChains from 'viem/chains';

import type { Config, DeGovConfig, AppConfig, TokenConfig, ChainConfig } from '@/types/config';

import type { Chain } from 'viem';

let cachedConfig: Config | null = null;
let cachedChain: Chain | null = null;
let configPromise: Promise<Config> | null = null;

// Utility to get URL parameters in the browser
function getConfigUrlFromParams(): string | null {
  if (typeof window === 'undefined') return null;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('config');
}

// Fetch token metadata from contract
async function fetchTokenMetadata(address: `0x${string}`, chain: Chain): Promise<{ symbol: string; decimals: number }> {
  const client = createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0])
  });

  const [symbol, decimals] = await Promise.all([
    client.readContract({
      address,
      abi: [
        {
          constant: true,
          inputs: [],
          name: 'symbol',
          outputs: [{ name: '', type: 'string' }],
          type: 'function'
        }
      ],
      functionName: 'symbol'
    }) as Promise<string>,
    client.readContract({
      address,
      abi: [
        {
          constant: true,
          inputs: [],
          name: 'decimals',
          outputs: [{ name: '', type: 'uint8' }],
          type: 'function'
        }
      ],
      functionName: 'decimals'
    }) as Promise<number>
  ]);

  return { symbol, decimals };
}

// Create a custom chain from ChainConfig
function createChainFromConfig(chainConfig: ChainConfig): Chain {
  return {
    id: chainConfig.id,
    name: chainConfig.name,
    nativeCurrency: {
      name: chainConfig.nativeToken.symbol,
      symbol: chainConfig.nativeToken.symbol,
      decimals: chainConfig.nativeToken.decimals
    },
    rpcUrls: {
      default: {
        http: chainConfig.rpcs
      }
    },
    blockExplorers: {
      default: {
        name: 'Explorer',
        url: chainConfig.explorers[0]
      }
    },
    contracts: {
      multicall3: {
        address: chainConfig.contracts.multicall3.address,
        blockCreated: chainConfig.contracts.multicall3.blockCreated
      }
    }
  };
}

// Transform DeGov config to app config
async function transformDeGovConfig(degovConfig: DeGovConfig): Promise<AppConfig> {
  // Check if there are any apps
  if (!degovConfig.apps || degovConfig.apps.length === 0) {
    throw new Error('No apps found in config');
  }

  // Get current origin for validation
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  
  // Find an app that matches current origin
  const targetApp = degovConfig.apps.find(app => {
    try {
      const appUrl = new URL(app.link);
      return appUrl.origin === currentOrigin;
    } catch {
      return false; // Invalid URL
    }
  });

  // If no app matches current origin, throw error
  if (!targetApp) {
    const availableOrigins = degovConfig.apps
      .map(app => {
        try {
          return new URL(app.link).origin;
        } catch {
          return 'invalid-url';
        }
      })
      .filter(origin => origin !== 'invalid-url');
    
    throw new Error(`No app found for current origin "${currentOrigin}". Available origins: ${availableOrigins.join(', ')}`);
  }

  // Create chain from config
  const chain = createChainFromConfig(degovConfig.chain);

  // Fetch token metadata from contracts
  const [sourceTokenMeta, wrapTokenMeta] = await Promise.all([
    fetchTokenMetadata(targetApp.params.sourceToken.address, chain),
    fetchTokenMetadata(targetApp.params.wrapToken.address, chain)
  ]);

  const sourceToken: TokenConfig = {
    symbol: sourceTokenMeta.symbol,
    decimals: sourceTokenMeta.decimals,
    address: targetApp.params.sourceToken.address,
    icon: targetApp.params.sourceToken.icon
  };

  const wrapToken: TokenConfig = {
    symbol: wrapTokenMeta.symbol,
    decimals: wrapTokenMeta.decimals,
    address: targetApp.params.wrapToken.address,
    icon: targetApp.params.wrapToken.icon
  };

  return {
    name: targetApp.name,
    logo: degovConfig.logo,
    description: targetApp.description,
    chainId: degovConfig.chain.id,
    wallet: degovConfig.wallet,
    sourceToken,
    wrapToken,
    wrapContractAddress: wrapToken.address // Assuming wrap contract is the wrap token address
  };
}

export async function loadAppConfig(): Promise<Config> {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Prevent race conditions by caching the promise
  if (configPromise) {
    return configPromise;
  }

  configPromise = (async () => {
    try {
      // Get config URL from URL parameter or use default
      const configUrl = getConfigUrlFromParams();
      
      let response: Response;
      let yamlText: string;
      
      if (configUrl) {
        // Fetch from external URL
        response = await fetch(configUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch config from ${configUrl}: ${response.statusText}`);
        }
        yamlText = await response.text();
        
        // Parse as DeGov config format
        const degovConfig = load(yamlText) as DeGovConfig;
        
        // Validate required fields
        if (!degovConfig.wallet || !degovConfig.chain || !degovConfig.apps || degovConfig.apps.length === 0) {
          throw new Error('Invalid DeGov configuration: missing required fields');
        }
        
        // Transform to app config
        const appConfig = await transformDeGovConfig(degovConfig);
        const config: Config = { app: appConfig };
        
        cachedConfig = config;
        return config;
      } else {
        // Fall back to local config.yml
        response = await fetch('/config.yml');
        if (!response.ok) {
          // If local config doesn't exist, provide a helpful error
          if (response.status === 404) {
            throw new Error('No configuration found. Please provide a config URL parameter or ensure config.yml exists in the public folder.');
          }
          throw new Error(`Failed to fetch config: ${response.statusText}`);
        }
        
        yamlText = await response.text();
        const config = load(yamlText) as Config;
        
        // Validate required fields
        if (!config.app || !config.app.sourceToken || !config.app.wrapToken) {
          throw new Error('Invalid configuration: missing required fields');
        }
        
        cachedConfig = config;
        return config;
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      // Reset promise on error so it can be retried
      configPromise = null;
      throw error;
    }
  })();

  return configPromise;
}

export function getChainById(chainId: number): Chain | null {
  if (cachedChain && cachedChain.id === chainId) {
    return cachedChain;
  }

  // Search through all available chains from viem
  for (const chain of Object.values(allChains)) {
    if (chain.id === chainId) {
      cachedChain = chain;
      return chain;
    }
  }
  
  // If not found in viem chains, check if we have a cached config with custom chain
  if (cachedConfig && cachedConfig.app.chainId === chainId) {
    // We need to reconstruct the chain from our cached config
    // This should only happen after config is loaded
    return null; // Will be handled by getAppChain()
  }
  
  return null;
}

export async function getAppChain(): Promise<Chain> {
  const config = await loadAppConfig();
  let chain = getChainById(config.app.chainId);
  
  if (!chain) {
    // If not found in viem chains and we have a config URL, the chain might be custom
    const configUrl = getConfigUrlFromParams();
    if (configUrl) {
      // Fetch the DeGov config again to get chain details
      const response = await fetch(configUrl);
      if (response.ok) {
        const yamlText = await response.text();
        const degovConfig = load(yamlText) as DeGovConfig;
        chain = createChainFromConfig(degovConfig.chain);
        cachedChain = chain;
      }
    }
  }
  
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${config.app.chainId}`);
  }
  
  return chain;
}

export async function getTokenConfig() {
  const config = await loadAppConfig();
  return {
    sourceToken: config.app.sourceToken,
    wrapToken: config.app.wrapToken,
    wrapContractAddress: config.app.wrapContractAddress
  };
}

export async function getAppInfo() {
  const config = await loadAppConfig();
  return {
    name: config.app.name,
    logo: config.app.logo,
    description: config.app.description
  };
}