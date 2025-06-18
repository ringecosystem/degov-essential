import { Service } from "typedi";
import { DegovConfig, DegovMcpDao } from "../types";
import { FastifyInstance } from "fastify";
import yaml from "yaml";
import { DegovAgentSource } from "../internal/agent-source";

@Service()
export class DaoService {
  constructor(private readonly degovAgentSource: DegovAgentSource) {}

  private async fetchDegovConfig(
    fastify: FastifyInstance,
    configLink: string
  ): Promise<DegovConfig | undefined> {
    const cacheKey = `degov-config-${configLink}`;
    const cachedConfig = await fastify.cache.get(cacheKey);
    if (cachedConfig) {
      return cachedConfig as DegovConfig;
    }
    try {
      const response = await fastify.axios.get(configLink);
      if (!response.data) {
        return;
      }
      const output = yaml.parse(response.data) as DegovConfig;
      await fastify.cache.set(cacheKey, output, 60 * 60); // Cache for 1 hour
      return output;
    } catch (error) {
      fastify.log.error(
        `Failed to fetch degov config from ${configLink}: ${error}`
      );
      return;
    }
  }

  async updateProgress(
    fastify: FastifyInstance,
    options: { code: string; lastBlockNumber: number }
  ): Promise<void> {
    const prisma = fastify.prisma;
    const { code, lastBlockNumber } = options;
    const existingProgress = await prisma.degov_dao_progress.findUnique({
      where: { code },
    });
    if (existingProgress) {
      await prisma.degov_dao_progress.update({
        where: { code },
        data: { last_block_number: lastBlockNumber, utime: new Date() },
      });
    } else {
      await prisma.degov_dao_progress.create({
        data: {
          id: fastify.snowflake.generate(),
          code,
          last_block_number: lastBlockNumber,
        },
      });
    }
    fastify.log.debug(
      `Updated degov dao progress for code ${code} to last block number ${lastBlockNumber}`
    );
  }

  async daos(fastify: FastifyInstance): Promise<DegovMcpDao[]> {
    const prisma = fastify.prisma;
    const daos = this.degovAgentSource.getDaos();

    const result: DegovMcpDao[] = [];

    const daoCodes = daos.map((dao) => dao.code);
    const daoProgresses = await prisma.degov_dao_progress.findMany({
      where: {
        code: {
          in: daoCodes,
        },
      },
    });

    for (const daoc of daos) {
      const { name, code, xprofile, links } = daoc;
      const configLink = links.config;
      const degovConfig = await this.fetchDegovConfig(fastify, configLink);
      const daoProgress = daoProgresses.find((item) => item.code === code);
      const dmd: DegovMcpDao = {
        name,
        code,
        xprofile,
        links,
        config: degovConfig,
        lastProcessedBlock: daoProgress?.last_block_number ?? -1,
      };
      result.push(dmd);
    }
    return result;
  }

  async dao(
    fastify: FastifyInstance,
    options: { daocode: string }
  ): Promise<DegovMcpDao | undefined> {
    const daos = await this.daos(fastify);
    return daos.find((dao) => dao.code === options.daocode);
  }
}
