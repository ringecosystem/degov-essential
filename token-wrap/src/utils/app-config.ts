import { load } from 'js-yaml';
import * as allChains from 'viem/chains';

import type { Config } from '@/types/config';

import type { Chain } from 'viem';

let cachedConfig: Config | null = null;
let cachedChain: Chain | null = null;
let configPromise: Promise<Config> | null = null;

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
      const response = await fetch('/config.yml');
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
      }
      
      const yamlText = await response.text();
      const config = load(yamlText) as Config;
      
      // Validate required fields
      if (!config.app || !config.app.sourceToken || !config.app.wrapToken) {
        throw new Error('Invalid configuration: missing required fields');
      }
      
      cachedConfig = config;
      return config;
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
  
  return null;
}

export async function getAppChain(): Promise<Chain> {
  const config = await loadAppConfig();
  const chain = getChainById(config.app.chainId);
  
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