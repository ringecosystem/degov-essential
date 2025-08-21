import { Service } from "typedi";
import { Address, createPublicClient, http } from "viem";
import * as viemChain from "viem/chains";

@Service()
export class EnsClient {
  private client() {
    return createPublicClient({
      chain: viemChain.mainnet,
      transport: http(), // viemChain.mainnet.rpcUrls.default.http[0]
    });
  }

  async findTwitterUsername(
    address: Address
  ): Promise<FindTwitterUsernameResult> {
    const client = this.client();

    try {
      const ensName = await client.getEnsName({
        address: address,
      });

      if (!ensName) {
        return {
          code: 1,
          message: `ENS name not found for address ${address}`,
        };
      }

      const twitterUsername = await client.getEnsText({
        name: ensName,
        key: "com.twitter", // Offical recommended Twitter record key
      });

      if (twitterUsername) {
        return {
          ensname: ensName,
          username: twitterUsername,
          code: 0,
        };
      }

      return {
        ensname: ensName,
        message: `this ens (${ensName}) username is not set`,
        code: 2,
      };
    } catch (error) {
      return {
        code: 1,
        message: `An error occurred while fetching ENS profile ${error}`,
      };
    }
  }
}

export interface FindTwitterUsernameResult {
  ensname?: string;
  username?: string;
  code: number;
  message?: string;
}
