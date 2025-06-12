import { FastifyInstance } from "fastify";
import { Service } from "typedi";
import { DegovTweetStatus } from "../types";
import { degov_tweet } from "../generated/prisma";

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

  async updateProcessError(
    fastify: FastifyInstance,
    options: { id: string; times: number; message?: string }
  ) {
    const prisma = fastify.prisma;
    const times_processed = options.times;
    const message = options.message;
    await prisma.degov_tweet.update({
      where: {
        id: options.id,
      },
      data: {
        times_processed,
        ...(times_processed > 3 && { status: DegovTweetStatus.Error }),
        ...(message && { message: message }),
      },
    });
  }

  async nextCheckVoteTweets(
    fastify: FastifyInstance,
    options?: { limit?: number }
  ): Promise<degov_tweet[]> {
    const prisma = fastify.prisma;
    const take = options?.limit ?? 10;
    const tweets = await prisma.degov_tweet.findMany({
      where: {
        status: DegovTweetStatus.Posted,
        type: "poll",
        times_processed: {
          lt: 3, // Only check proposals that have been processed less than 3 times
        },
      },
      orderBy: {
        ctime: "asc",
        times_processed: "asc",
      },
      take,
    });

    return tweets;
  }
}
