import { createPublicClient, http, type Address, erc20Abi, erc721Abi } from 'viem';

import { supportedChainsById } from '@/config/chains';
import type { TokenStandard } from '@/config/dao';

export interface TokenInfo {
  name: string;
  symbol: string;
  owner: string;
  decimals?: number; // Only for ERC20
}

/**
 * Create a public client for a specific chain
 * @param chainId - Chain ID
 * @returns Public client instance
 */
function createPublicClientForChain(chainId: number) {
  const chain = supportedChainsById[chainId];
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  return createPublicClient({
    chain,
    transport: http()
  });
}

/**
 * Get token information from contract
 * @param address - Contract address
 * @param tokenType - Token standard (ERC20 or ERC721)
 * @param chainId - Chain ID
 * @returns Token information or null if failed
 */
export async function getTokenInfo(
  address: Address,
  tokenType: TokenStandard,
  chainId: number
): Promise<TokenInfo | null> {
  try {
    const abi = tokenType === 'ERC20' ? erc20Abi : erc721Abi;
    const publicClient = createPublicClientForChain(chainId);

    // Get basic token info first
    const basicInfoResults = await publicClient.multicall({
      contracts: [
        {
          address,
          abi,
          functionName: 'name'
        },
        {
          address,
          abi,
          functionName: 'symbol'
        },
        // Only get decimals for ERC20
        ...(tokenType === 'ERC20'
          ? [
              {
                address,
                abi,
                functionName: 'decimals'
              }
            ]
          : [])
      ]
    });

    // Extract basic results
    const nameResult = basicInfoResults[0];
    const symbolResult = basicInfoResults[1];
    const decimalsResult = tokenType === 'ERC20' ? basicInfoResults[2] : null;

    // Check if all required calls succeeded
    if (nameResult.status !== 'success' || symbolResult.status !== 'success') {
      throw new Error('Failed to get basic token info');
    }

    // Try to get owner info separately (might not exist on all contracts)
    let owner = '0x0000000000000000000000000000000000000000';
    try {
      // Define a minimal owner ABI for contracts that have an owner function
      const ownerAbi = [
        {
          name: 'owner',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ type: 'address' }]
        }
      ] as const;

      const ownerResult = await publicClient.readContract({
        address,
        abi: ownerAbi,
        functionName: 'owner'
      });
      owner = ownerResult as string;
    } catch (error) {
      // Owner function doesn't exist or failed, use default
      console.log('Owner function not available for this contract');
    }

    const tokenInfo: TokenInfo = {
      name: nameResult.result as string,
      symbol: symbolResult.result as string,
      owner,
      ...(tokenType === 'ERC20' &&
        decimalsResult?.status === 'success' && {
          decimals: decimalsResult.result as number
        })
    };

    return tokenInfo;
  } catch (error) {
    console.error('Error getting token info:', error);
    return null;
  }
}

/**
 * Validate if an address is a valid token contract
 * @param address - Contract address to validate
 * @param tokenType - Expected token standard
 * @param chainId - Chain ID
 * @returns boolean indicating if it's a valid token contract
 */
export async function validateTokenContract(
  address: Address,
  tokenType: TokenStandard,
  chainId: number
): Promise<boolean> {
  try {
    const abi = tokenType === 'ERC20' ? erc20Abi : erc721Abi;
    const publicClient = createPublicClientForChain(chainId);

    if (tokenType === 'ERC721') {
      // For ERC721, try to call a standard function like name
      await publicClient.readContract({
        address,
        abi,
        functionName: 'name'
      });
      return true;
    } else {
      // For ERC20, try to call totalSupply which is required
      await publicClient.readContract({
        address,
        abi,
        functionName: 'totalSupply'
      });
      return true;
    }
  } catch (error) {
    console.error('Error validating token contract:', error);
    return false;
  }
}
