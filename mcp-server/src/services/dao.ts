import { Service } from "typedi";
import { DegovConfig, DegovMcpDao, NewProposalEvent } from "../types";
import { ConfigReader } from "../integration/config-reader";
import { FastifyInstance } from "fastify";
import yaml from "yaml";
import { DegovIndexerProposal } from "../internal/graphql";

@Service()
export class DaoService {
  constructor(private readonly degovIndexerProposal: DegovIndexerProposal) {}

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

  async daos(fastify: FastifyInstance): Promise<DegovMcpDao[]> {
    const prisma = fastify.prisma;
    const daos = ConfigReader.degovDaos();
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

  async nextNewProposals(
    fastify: FastifyInstance
  ): Promise<NewProposalEvent[]> {
    const daos = await this.daos(fastify);
    const results: NewProposalEvent[] = [];

    for (const dao of daos) {
      if (!dao.xprofile) {
        continue;
      }
      const chainId = dao.config?.chain?.id;
      if (!chainId) {
        fastify.log.warn(
          `Chain ID not found for DAO ${dao.name}. Skipping proposal processing.`
        );
        continue;
      }
      const proposal = await this.degovIndexerProposal.queryNextProposal({
        endpoint: dao.links.indexer,
        lastBlockNumber: dao.lastProcessedBlock ?? 0,
      });
      if (!proposal) {
        fastify.log.info(
          `No new proposals found for DAO ${dao.name} with code ${dao.code}.`
        );
        continue; // No new proposals found
      }
      const npe: NewProposalEvent = {
        xprofile: dao.xprofile,
        daocode: dao.code,
        daoname: dao.name,
        proposal: {
          id: proposal.proposalId,
          chainId,
          url: `${dao.links.website}/proposal/${proposal.proposalId}`,
          voteStart: parseInt(proposal.voteStart),
          voteEnd: parseInt(proposal.voteEnd),
          description: proposal.description,
        },
      };
      results.push(npe);
    }

    return results;
  }
}
