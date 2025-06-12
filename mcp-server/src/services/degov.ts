import { FastifyInstance } from "fastify";
import { Service } from "typedi";
import { DegovTweetStatus } from "../types";

@Service()
export class DegovService {
  async updateTweetStatus(
    fastify: FastifyInstance,
    options: { proposalId: string; status: DegovTweetStatus }
  ) {
    const prisma = fastify.prisma;
    await prisma.degov_tweet.updateMany({
      where: {
        proposal_id: options.proposalId,
      },
      data: {
        status: options.status,
      },
    });
  }
}
