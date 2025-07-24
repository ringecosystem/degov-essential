import { Service } from "typedi";
import { DegovMcpDao } from "../types";
import { FastifyInstance } from "fastify";
import { DegovAgentSource } from "../internal/agent-source";

@Service()
export class DaoService {
  constructor(private readonly degovAgentSource: DegovAgentSource) {}

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
      const { code, xprofile, carry } = daoc;
      // const degovConfig = await this.fetchDegovConfig(fastify, configLink);
      const daoProgress = daoProgresses.find((item) => item.code === code);
      const dmd: DegovMcpDao = {
        code,
        xprofile,
        carry: carry ?? [],
        config: daoc.config,
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
