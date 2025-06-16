import { FastifyInstance } from "fastify";
import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";
import { Service } from "typedi";
import { EnvReader } from "../integration/env-reader";
import { DegovService } from "../services/degov";
import {
  degov_tweet,
  twitter_poll_option,
  twitter_tweet,
} from "../generated/prisma";
import { DaoService } from "../services/dao";
import { DegovMcpDao } from "../types";
import { TwitterService } from "../services/twitter";
import { DegovIndexerProposal } from "../internal/graphql";
import { DegovTweetSyncTask } from "./tweet-sync";
import { DegovHelpers } from "../helpers";
import { generateObject } from "ai";
import { DegovPrompt } from "../internal/prompt";
import { OpenrouterAgent } from "../internal/openrouter";
import { z } from "zod";
import { GovernorContract } from "../internal/governor";

@Service()
export class DegovProposalFulfillTask {
  constructor(
    private readonly degovService: DegovService,
    private readonly twitterService: TwitterService,
    private readonly daoService: DaoService,
    private readonly degovIndexerProposal: DegovIndexerProposal,
    private readonly degovTweetSyncTask: DegovTweetSyncTask,
    private readonly openrouterAgent: OpenrouterAgent,
    private readonly governorContract: GovernorContract
  ) {}

  async start(fastify: FastifyInstance) {
    const task = new AsyncTask("task-proposal-fulfill", async () => {
      try {
        const enableFeature = EnvReader.envBool(
          "FEATURE_TASK_PROPOSAL_FULFILL",
          {
            defaultValue: "true",
          }
        );
        if (!enableFeature) {
          fastify.log.warn(
            "FEATURE_TASK_PROPOSAL_FULFILL is disabled, skipping task."
          );
          return;
        }

        await this.run(fastify);
      } catch (err) {
        fastify.log.error(err);
      }
    });
    const job = new SimpleIntervalJob(
      {
        minutes: 3,
        runImmediately: true,
      },
      task
    );
    fastify.ready().then(() => {
      fastify.scheduler.addSimpleIntervalJob(job);
    });
  }

  private async run(fastify: FastifyInstance) {
    const unfulfilledTweets = await this.degovService.listUnfulfilledTweets(
      fastify
    );
    for (const unfulfilledTweet of unfulfilledTweets) {
      try {
        const dao = await this.daoService.dao(fastify, {
          daocode: unfulfilledTweet.daocode,
        });
        if (!dao) {
          throw new Error(
            `DAO not found for tweet ${unfulfilledTweet.id}, cannot fulfill tweet poll.`
          );
        }
        await this.fulfillGovernorFromTweet(fastify, {
          tweet: unfulfilledTweet,
          dao,
        });
      } catch (err) {
        const times_processed = unfulfilledTweet.times_processed + 1;
        const messages = [];
        messages.push(
          `[${times_processed}] Error processing tweet ${
            unfulfilledTweet.id
          }: ${err instanceof Error ? err.message : String(err)}`
        );
        if (unfulfilledTweet.message) {
          messages.push(unfulfilledTweet.message);
        }
        const message = messages.join("========");

        fastify.log.error(
          `${message} ${err instanceof Error ? err.stack : ""}`
        );
        await this.degovService.updateProcessError(fastify, {
          id: unfulfilledTweet.id,
          times: times_processed,
          message,
        });
        continue;
      }
    }
  }

  private async fulfillGovernorFromTweet(
    fastify: FastifyInstance,
    options: {
      tweet: degov_tweet;
      dao: DegovMcpDao;
    }
  ) {
    const { tweet, dao } = options;

    const daoConfig = dao.config;
    if (!daoConfig || !daoConfig.links) {
      throw new Error(
        `DAO config or links not found for DAO ${dao.code}, cannot fulfill tweet poll.`
      );
    }

    let tweetPoll = await this.twitterService.queryPoll(fastify, {
      tweetId: tweet.id,
    });
    if (!tweetPoll) {
      throw new Error(
        `No poll found for tweet ${tweet.id}, cannot fulfill tweet poll.`
      );
    }
    if (!tweetPoll.end_datetime) {
      throw new Error(
        `Poll end time not found for tweet ${tweet.id}, cannot fulfill tweet poll.`
      );
    }

    // check if the poll has ended
    const now = new Date();
    const pollEndTime = new Date(tweetPoll.end_datetime);

    if (pollEndTime > now) {
      fastify.log.info(
        `Tweet poll ${
          tweet.id
        } has not ended yet. End time: ${pollEndTime.toISOString()}, Current time: ${now.toISOString()}`
      );
      return;
    }
    const tweetId = tweetPoll.tweet_id;
    const degovTweet = await this.degovService.getDegovTweetById(fastify, {
      id: tweetId,
    });
    if (!degovTweet) {
      throw new Error(
        `Degov tweet not found for tweet ID ${tweetId}, cannot fulfill tweet poll.`
      );
    }
    await this.degovTweetSyncTask.syncTweet(fastify, {
      tweet: degovTweet,
      dao,
    });
    tweetPoll = await this.twitterService.queryPoll(fastify, {
      tweetId: tweet.id,
    });
    if (!tweetPoll) {
      throw new Error(
        `No poll found for tweet ${tweet.id} after sync, cannot fulfill tweet poll.`
      );
    }
    // tweetPoll.twitter_poll_option
    const pollOptions: twitter_poll_option[] = [];
    if ("twitter_poll_option" in tweetPoll) {
      pollOptions.push(
        ...(tweetPoll.twitter_poll_option as twitter_poll_option[])
      );
    }

    const fullTweet = await this.twitterService.getTweetById(fastify, {
      id: tweet.id,
      includeReplies: true,
    });
    if (!fullTweet) {
      throw new Error(
        `Full tweet not found for tweet ID ${tweet.id}, cannot fulfill tweet poll.`
      );
    }

    const voteCasts = await this.degovIndexerProposal.queryProposalVotes({
      endpoint: dao.links.indexer,
      proposalId: tweet.proposal_id,
      offset: 0,
      enableQueryFullData: true,
    });

    const allUserReplies = this.filterTweetReplies(fullTweet);

    const filteredPollOptions = pollOptions.map((item) => {
      return {
        label: item.label,
        votes: item.votes,
        position: item.position,
      };
    });
    const filteredReplies = allUserReplies.map((item) => {
      return {
        text: item.text ?? "",
        like_count: item.like_count ?? 0,
        retweet_count: item.retweet_count ?? 0,
        reply_count: item.reply_count ?? 0,
        ctime: item.ctime,
      };
    });
    const filteredVoteCasts = voteCasts.map((item) => {
      return {
        support: DegovHelpers.voteSupportText(item.support),
        reason: item.reason,
        // voter: item.voter,
        weight: item.weight,
        blockTimestamp: new Date(+item.blockTimestamp),
      };
    });

    const promptout = await DegovPrompt.fulfillContract(fastify, {
      pollOptions: filteredPollOptions,
      tweetReplies: filteredReplies,
      voteCasts: filteredVoteCasts,
    });
    fastify.log.info(
      `Fulfill contract prompt for proposal ${tweet.proposal_id}: ${promptout.prompt}`
    );

    const aiResp = await generateObject({
      model: this.openrouterAgent.openrouter(EnvReader.aiModel()),
      schema: AnalysisResultSchema,
      system: promptout.system,
      prompt: promptout.prompt,
    });

    // await this.governorContract.castVoteWithReason({
    //   chainId: daoConfig.chain.id,
    //   contractAddress: DegovHelpers.stdHex(daoConfig.contracts.governor),
    //   proposalId: BigInt(tweet.proposal_id),
    //   support: DegovHelpers.voteSupportNumber(aiResp.object.finalResult),
    //   reason: aiResp.object.reasoning,
    // });
    const fulfilledExplain = {
      input: {
        pollOptions: filteredPollOptions,
        tweetReplies: filteredReplies,
        voteCasts: filteredVoteCasts,
      },
      output: aiResp.object,
    };
    await this.degovService.updateProposalFulfilled(fastify, {
      id: tweet.id,
      fulfilledExplain: JSON.stringify(fulfilledExplain),
    });
    fastify.log.info(
      `Proposal ${tweet.proposal_id} fulfilled with result: ${aiResp.object.finalResult}, confidence: ${aiResp.object.confidence}`
    );
  }

  private filterTweetReplies(tweet: twitter_tweet): twitter_tweet[] {
    if (!("replies" in tweet)) {
      return [];
    }
    const replies = tweet.replies as unknown as twitter_tweet[];
    return replies.filter((reply) => reply.from_agent === 0);
  }
}

const AnalysisResultSchema = z.object({
  finalResult: z.enum(["For", "Against", "Abstain"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  votingBreakdown: z.object({
    twitterPoll: z.object({
      for: z.number(),
      against: z.number(),
      abstain: z.number(),
    }),
    twitterComments: z.object({
      positive: z.number(),
      negative: z.number(),
      neutral: z.number(),
    }),
    onChainVotes: z.object({
      for: z.number(),
      against: z.number(),
      abstain: z.number(),
    }),
  }),
});
