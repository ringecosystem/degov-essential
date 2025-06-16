import { FastifyInstance } from "fastify";
import { Service } from "typedi";
import {
  AddVoteProgressForm,
  DegovSummaryForm,
  ProposalState,
  UpdateVoteProgressForm,
} from "../types";
import { degov_tweet, degov_vote_progress } from "../generated/prisma";
import { OpenrouterAgent } from "../internal/openrouter";
import { DegovIndexer } from "../internal/graphql";
import { DegovPrompt } from "../internal/prompt";
import { generateText } from "ai";
import { EnvReader } from "../integration/env-reader";

@Service()
export class DegovService {
  constructor(
    private readonly openrouterAgent: OpenrouterAgent,
    private readonly degovIndexer: DegovIndexer
  ) {}

  async updateTweetStatus(
    fastify: FastifyInstance,
    options: { proposalId: string; status: ProposalState }
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
        ...(times_processed > 3 && { errored: 1 }),
        ...(message && { message: message }),
      },
    });
  }

  async listPollTweetsByStatus(
    fastify: FastifyInstance,
    options: { status: ProposalState[]; fulfilled?: number }
  ): Promise<degov_tweet[]> {
    const prisma = fastify.prisma;
    const results = await prisma.degov_tweet.findMany({
      where: {
        status: {
          in: options.status,
        },
        type: "poll",
        fulfilled: options.fulfilled ?? 0,
      },
      orderBy: [{ ctime: "asc" }, { times_processed: "asc" }],
    });
    return results;
  }

  async listUnfulfilledTweets(
    fastify: FastifyInstance
  ): Promise<degov_tweet[]> {
    const prisma = fastify.prisma;
    const results = await prisma.degov_tweet.findMany({
      where: {
        status: ProposalState.Active,
        type: "poll",
        fulfilled: 0,
        times_processed: {
          lte: 4, // Only check proposals that have been processed less than 3 times
        },
      },
      orderBy: [{ ctime: "asc" }, { times_processed: "asc" }],
    });
    return results;
  }

  async nextCheckVoteTweets(
    fastify: FastifyInstance,
    options?: { limit?: number }
  ): Promise<degov_tweet[]> {
    const prisma = fastify.prisma;
    const take = options?.limit ?? 10;
    const tweets = await prisma.degov_tweet.findMany({
      where: {
        status: ProposalState.Active,
        type: "poll",
        times_processed: {
          lt: 3, // Only check proposals that have been processed less than 3 times
        },
      },
      orderBy: [{ ctime: "asc" }, { times_processed: "asc" }],
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

  async updateReplyNextToken(
    fastify: FastifyInstance,
    options: {
      id: string;
      replyNextToken: string;
    }
  ): Promise<void> {
    const prisma = fastify.prisma;
    await prisma.degov_tweet.update({
      where: { id: options.id },
      data: { reply_next_token: options.replyNextToken, utime: new Date() },
    });
    fastify.log.debug(
      `Updated degov tweet ${options.id} with reply next token ${options.replyNextToken}`
    );
  }

  async updateDegovTweetSyncTweet(
    fastify: FastifyInstance,
    options: {
      id: string;
      syncNextTimeTweet?: Date;
      syncStopTweet?: number;
    }
  ): Promise<void> {
    const prisma = fastify.prisma;
    await prisma.degov_tweet.update({
      where: { id: options.id },
      data: {
        ...(options.syncNextTimeTweet && {
          sync_next_time_tweet: options.syncNextTimeTweet,
        }),
        ...(options.syncStopTweet && {
          sync_stop_tweet: options.syncStopTweet,
        }),
        utime: new Date(),
      },
    });
  }

  async updateDegovTweetSyncReply(
    fastify: FastifyInstance,
    options: {
      id: string;
      syncNextTimeReply?: Date;
      syncStopReply?: number;
    }
  ): Promise<void> {
    const prisma = fastify.prisma;
    await prisma.degov_tweet.update({
      where: { id: options.id },
      data: {
        ...(options.syncNextTimeReply && {
          sync_next_time_reply: options.syncNextTimeReply,
        }),
        ...(options.syncStopReply && {
          sync_stop_reply: options.syncStopReply,
        }),
        utime: new Date(),
      },
    });
  }

  async getDegovTweetById(
    fastify: FastifyInstance,
    options: {
      id: string;
    }
  ): Promise<degov_tweet | undefined> {
    const prisma = fastify.prisma;
    const result = await prisma.degov_tweet.findUnique({
      where: {
        id: options.id,
      },
    });
    return result ?? undefined;
  }

  async updateProposalFulfilled(
    fastify: FastifyInstance,
    options: {
      id: string;
      fulfilledExplain: string;
    }
  ) {
    const prisma = fastify.prisma;
    await prisma.degov_tweet.update({
      where: {
        id: options.id,
      },
      data: {
        fulfilled: 1,
        fulfilled_explain: options.fulfilledExplain,
        utime: new Date(),
      },
    });
    fastify.log.info(`Updated degov tweet ${options.id} as fulfilled`);
  }

  async generateProposalSummary(
    fastify: FastifyInstance,
    options: DegovSummaryForm
  ): Promise<string> {
    const proposal = await this.degovIndexer.queryProposalById({
      proposalId: options.id,
      endpoint: options.indexer,
    });
    if (!proposal) {
      throw new Error(`Proposal with ID ${options.id} not found`);
    }
    const promptInput = {
      description: proposal.description,
    };
    const promptout = await DegovPrompt.proposalSummary(fastify, promptInput);
    const aiResp = await generateText({
      model: this.openrouterAgent.openrouter(EnvReader.aiModel()),
      system: promptout.system,
      prompt: promptout.prompt,
    });

    return aiResp.text;
  }
}
