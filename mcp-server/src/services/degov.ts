import { FastifyInstance } from "fastify";
import { Service } from "typedi";
import {
  AddVoteProgressForm,
  DegovTweetStatus,
  UpdateVoteProgressForm,
} from "../types";
import { degov_tweet, degov_vote_progress } from "../generated/prisma";

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

  async currentVoteProgress(
    fastify: FastifyInstance,
    options: { proposalId: string }
  ): Promise<degov_vote_progress | undefined> {
    const prisma = fastify.prisma;
    const result = await prisma.degov_vote_progress.findFirst({
      where: {
        proposal_id: options.proposalId,
      },
    });
    return result ?? undefined;
  }

  async modifyVoteProgress(
    fastify: FastifyInstance,
    form: AddVoteProgressForm | UpdateVoteProgressForm
  ): Promise<degov_vote_progress> {
    const prisma = fastify.prisma;
    const existing = await prisma.degov_vote_progress.findFirst({
      where: {
        proposal_id: form.proposal_id,
      },
    });
    if (existing) {
      return await prisma.degov_vote_progress.update({
        where: {
          id: existing.id,
        },
        data: {
          offset: form.offset,
          utime: new Date(),
        },
      });
    }
    // Only AddVoteProgressForm should be used for creation
    if ("daocode" in form && "chain_id" in form) {
      return await prisma.degov_vote_progress.create({
        data: {
          id: fastify.snowflake.generate(),
          daocode: form.daocode,
          proposal_id: form.proposal_id,
          chain_id: form.chain_id,
          offset: form.offset,
        },
      });
    }
    throw new Error("Missing required fields for creating vote progress");
  }
}
