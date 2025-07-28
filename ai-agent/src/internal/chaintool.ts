import { FastifyInstance } from "fastify";
import { Service } from "typedi";
import { createPublicClient, http, Block } from "viem";
import * as viemChain from "viem/chains";

export interface BlockIntervalOptions {
  chainId: number;
  endpoint: string;
}

@Service()
export class ChainTool {
  private blockIntervalCache = new Map<string, number>();

  async pickRpc(options: { rpcs?: string[] }): Promise<string> {
    if (!options || !options.rpcs) {
      throw new Error("No RPC endpoints provided");
    }
    if (!options.rpcs || options.rpcs.length === 0) {
      throw new Error("No RPC endpoints available");
    }
    return options.rpcs[0];
  }

  async blockInterval(
    fastify: FastifyInstance,
    options: BlockIntervalOptions
  ): Promise<number> {
    const cacheKey = `${options.chainId}`;

    if (this.blockIntervalCache.has(cacheKey)) {
      fastify.log.info(
        `Using cached block interval for chain ${options.chainId}`
      );
      return this.blockIntervalCache.get(cacheKey)!;
    }

    try {
      const client = this.createViemClient(options);

      const latestBlockNumber = await client.getBlockNumber();

      // calculate the range of blocks to fetch (last 10 blocks)
      const fromBlock = latestBlockNumber - BigInt(9); // get 10 blocks
      const blocks: Block[] = [];

      fastify.log.info(
        `Fetching blocks from ${fromBlock} to ${latestBlockNumber} for chain ${options.chainId}`
      );

      // batch fetch block information
      const blockPromises: Promise<Block>[] = [];
      for (let i = fromBlock; i <= latestBlockNumber; i++) {
        blockPromises.push(client.getBlock({ blockNumber: i }));
      }

      // wait for all block information to be fetched
      const fetchedBlocks = await Promise.all(blockPromises);
      blocks.push(...fetchedBlocks);

      if (blocks.length < 2) {
        throw new Error("Need at least 2 blocks to calculate interval");
      }

      // calculate average block interval
      let totalInterval = 0;
      let intervalCount = 0;

      for (let i = 1; i < blocks.length; i++) {
        const currentBlock = blocks[i];
        const previousBlock = blocks[i - 1];

        if (currentBlock.timestamp && previousBlock.timestamp) {
          const interval = Number(
            currentBlock.timestamp - previousBlock.timestamp
          );
          totalInterval += interval;
          intervalCount++;
        }
      }

      if (intervalCount === 0) {
        throw new Error("No valid block intervals found");
      }

      const averageInterval = Math.round(totalInterval / intervalCount);

      this.blockIntervalCache.set(cacheKey, averageInterval);

      fastify.log.info(
        `Calculated average block interval for chain ${options.chainId}: ${averageInterval}s`
      );

      return averageInterval;
    } catch (error) {
      fastify.log.error(
        `Failed to calculate block interval for chain ${options.chainId}:`,
        error
      );
      throw error;
    }
  }

  private createViemClient(options: BlockIntervalOptions) {
    // try to find the chain configuration from viem/chains
    const chain = Object.values(viemChain).find(
      (chain) => chain.id.toString() === options.chainId.toString()
    );

    if (chain) {
      return createPublicClient({
        chain,
        transport: options.endpoint ? http(options.endpoint) : http(),
      });
    }

    // if no chain found, use custom endpoint
    if (options.endpoint) {
      return createPublicClient({
        transport: http(options.endpoint),
      });
    }

    throw new Error(
      `Chain with id ${options.chainId} not found and no endpoint provided.`
    );
  }
}
