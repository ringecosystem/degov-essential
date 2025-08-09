import { load } from 'js-yaml';
import { createPublicClient, http } from 'viem';
import * as allChains from 'viem/chains';

import type { Config, DeGovConfig, AppConfig, TokenConfig, ChainConfig } from '@/types/config';

import type { Chain } from 'viem';

function getQueryParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  const urlParams = new URLSearchParams(window.location.search);
  const value = urlParams.get(name);
  return value && value.trim().length > 0 ? value.trim() : null;
}

// Expose where config should be loaded from
export function getConfigSourceFromParams(): {
  key: 'dao' | 'config' | null;
  value: string | null;
} {
  const dao = getQueryParam('dao');
  if (dao) return { key: 'dao', value: dao };
  const config = getQueryParam('config');
  if (config) return { key: 'config', value: config };
  return { key: null, value: null };
}

// Build remote API URL: if `dao` param exists, use https://api.degov.ai/dao/config/${dao}?format=yml
export function buildRemoteApiUrl(): string | undefined {
  const dao = getQueryParam('dao');
  if (!dao) return undefined;
  const base = 'https://api.degov.ai';
  return `${base}/dao/config/${dao}?format=yml`;
}

// Fetch and validate DeGov config from query param or remote API
async function fetchDeGovConfig(): Promise<DeGovConfig> {
  const source = getConfigSourceFromParams();

  let url: string | undefined | null = undefined;

  if (source.key === 'dao') {
    url = buildRemoteApiUrl();
  } else if (source.key === 'config') {
    url = source.value;
  }

  if (!url) {
    throw new Error('No configuration source found. Provide ?dao=... or ?config=...');
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch config from ${url}: ${response.statusText}`);
  }

  const yamlText = await response.text();
  const degovConfig = load(yamlText) as DeGovConfig;

  if (
    !degovConfig.wallet ||
    !degovConfig.chain ||
    !degovConfig.apps ||
    degovConfig.apps.length === 0
  ) {
    throw new Error('Invalid DeGov configuration: missing required fields');
  }

  return degovConfig;
}

// Fetch token metadata from contract
async function fetchTokenMetadata(
  address: `0x${string}`,
  chain: Chain
): Promise<{ symbol: string; decimals: number }> {
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
  const chain: Chain = {
    id: chainConfig?.id,
    name: chainConfig?.name,
    nativeCurrency: {
      name: chainConfig?.nativeToken.symbol,
      symbol: chainConfig?.nativeToken.symbol,
      decimals: chainConfig?.nativeToken.decimals
    },
    rpcUrls: {
      default: {
        http: chainConfig?.rpcs
      }
    },
    blockExplorers: {
      default: {
        name: 'Explorer',
        url: chainConfig?.explorers[0]
      }
    }
  };

  // Add multicall3 contract if it exists
  if (chainConfig?.contracts?.multicall3) {
    chain.contracts = {
      multicall3: {
        address: chainConfig?.contracts?.multicall3?.address,
        blockCreated: chainConfig?.contracts?.multicall3?.blockCreated
      }
    };
  }

  return chain;
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
  const targetApp = degovConfig.apps.find((app) => {
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
      .map((app) => {
        try {
          return new URL(app.link).origin;
        } catch {
          return 'invalid-url';
        }
      })
      .filter((origin) => origin !== 'invalid-url');

    throw new Error(
      `No app found for current origin "${currentOrigin}". Available origins: ${availableOrigins.join(', ')}`
    );
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
    walletConnectProjectId: targetApp.params.walletConnectProjectId,
    sourceToken,
    wrapToken,
    wrapContractAddress: wrapToken.address // Assuming wrap contract is the wrap token address
  };
}

export function getChainById(chainId: number): Chain | null {
  // Search through all available chains from viem
  for (const chain of Object.values(allChains)) {
    if (chain.id === chainId) {
      return chain;
    }
  }

  return null;
}

export async function loadAppConfig(): Promise<Config> {
  try {
    const degovConfig = await fetchDeGovConfig();
    const appConfig = await transformDeGovConfig(degovConfig);
    return { app: appConfig };
  } catch (error) {
    console.error('Failed to load config:', error);
    throw error;
  }
}

export async function getAppChain(): Promise<Chain> {
  const config = await loadAppConfig();
  let chain = getChainById(config.app.chainId);

  // If not found in viem chains, try to reconstruct from remote DeGov config
  if (!chain) {
    const degovConfig = await fetchDeGovConfig();
    chain = createChainFromConfig(degovConfig.chain);
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
