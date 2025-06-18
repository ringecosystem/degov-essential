import { FastifyInstance } from "fastify";
import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";
import { Service } from "typedi";
import { EnvReader } from "../integration/env-reader";
import { DegovService } from "../services/degov";
import { DegovMcpDao, ProposalState } from "../types";
import { TwitterAgentW } from "../internal/x-agent/agentw";
import { degov_tweet } from "../generated/prisma";
import { DaoService } from "../services/dao";
import { DegovHelpers } from "../helpers";

@Service()
export class DegovTweetSyncTask {
  constructor(
    private readonly degovService: DegovService,
    private readonly twitterAgent: TwitterAgentW,
    private readonly daoService: DaoService
  ) {}

  async start(fastify: FastifyInstance) {
    const task = new AsyncTask("task-sync-tweet", async () => {
      try {
        const enableFeature = EnvReader.envBool("FEATURE_TASK_TWEET_SYNC", {
          defaultValue: "true",
        });
        if (!enableFeature) {
          fastify.log.warn(
            "[task-sync] FEATURE_TASK_TWEET_SYNC is disabled, skipping task."
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
        minutes: 2,
        runImmediately: true,
      },
      task
    );
    fastify.ready().then(() => {
      fastify.scheduler.addSimpleIntervalJob(job);
    });
  }

  private async run(fastify: FastifyInstance) {
    const trackTweets = await this.degovService.listPollTweetsByStatus(
      fastify,
      {
        status: [ProposalState.Active],
        fulfilleds: [0],
      }
    );
    for (const trackTweet of trackTweets) {
      try {
        const dao = await this.daoService.dao(fastify, {
          daocode: trackTweet.daocode,
        });
        if (!dao || !dao.xprofile) {
          fastify.log.warn(
            `[task-sync] No DAO profile found for tweet ${trackTweet.id}, skipping conversation sync.`
          );
          return;
        }

        await this.syncTweet(fastify, { tweet: trackTweet, dao });
        await this.syncConversation(fastify, { tweet: trackTweet, dao });
      } catch (err) {
        fastify.log.error(
          `[task-sync] Failed to sync conversation for tweet ${
            trackTweet.id
          }: ${DegovHelpers.helpfulErrorMessage(err)}`
        );
      }
    }
  }

  async syncTweet(
    fastify: FastifyInstance,
    options: {
      tweet: degov_tweet;
      dao: DegovMcpDao;
    }
  ) {
    const { tweet } = options;
    const sntt = tweet.sync_next_time_tweet;
    const syncStop = tweet.sync_stop_tweet ?? 1;
    if (syncStop) {
      fastify.log.info(
        `[task-sync] Skipping tweet ${tweet.id} sync, sync_stop_tweet is set to ${syncStop}`
      );
      return;
    }
    const now = new Date();
    if (sntt && sntt > now) {
      fastify.log.info(
        `[task-sync] Skipping tweet ${tweet.id} sync, next sync time is in the future: ${sntt}`
      );
      return;
    }
    const newTweet = await this.twitterAgent.getTweetById(fastify, {
      id: tweet.id,
      force: true, // Force query to ensure we get the latest data
      xprofile: options.dao.xprofile,
    });
    const polls = newTweet.includes?.polls;
    if (!polls || polls.length === 0) {
      await this.degovService.updateDegovTweetSyncTweet(fastify, {
        id: tweet.id,
        syncStopTweet: 1, // Stop syncing this tweet
      });
      fastify.log.info(
        `[task-sync] No polls found for tweet ${tweet.id}, stop sync this tweet.`
      );
      return;
    }
    const firstPoll = polls[0];
    if (firstPoll.end_datetime) {
      const end_datetime = new Date(firstPoll.end_datetime);
      await this.degovService.updateDegovTweetSyncTweet(fastify, {
        id: tweet.id,
        syncNextTimeTweet: new Date(end_datetime.getTime() - 1000 * 60 * 8), // 8 minutes before poll end
      });
      fastify.log.info(
        `[task-sync] Updated sync next time for tweet ${tweet.id} to 8 minutes before poll end: ${end_datetime}`
      );
    } else {
      await this.degovService.updateDegovTweetSyncTweet(fastify, {
        id: tweet.id,
        syncNextTimeTweet: new Date(Date.now() + 1000 * 60 * 60 * 2), // Sync again in 2 hours
      });
      fastify.log.info(
        `[task-sync] Poll for tweet ${tweet.id} has no end datetime, wait 2 hours to sync this tweet.`
      );
    }
  }

  private async syncConversation(
    fastify: FastifyInstance,
    options: { tweet: degov_tweet; dao: DegovMcpDao }
  ) {
    const { tweet, dao } = options;

    const sntt = tweet.sync_next_time_reply;
    const syncStop = tweet.sync_stop_reply ?? 1;
    if (syncStop) {
      fastify.log.info(
        `[task-sync] Skipping tweet ${tweet.id} sync, sync_stop_reply is set to ${syncStop}`
      );
      return;
    }
    const now = new Date();
    if (sntt && sntt > now) {
      fastify.log.info(
        `[task-sync] Skipping tweet ${tweet.id} sync, next sync time is in the future: ${sntt}`
      );
      return;
    }

    const result = await this.twitterAgent.searchTweets(fastify, {
      xprofile: dao.xprofile,
      query: `conversation_id:${tweet.id}`,
      previous_token: tweet.reply_next_token ?? undefined,
    });
    const nextToken = result.meta.next_token;
    if (nextToken) {
      await this.degovService.updateReplyNextToken(fastify, {
        id: tweet.id,
        replyNextToken: nextToken,
      });
      await this.degovService.updateDegovTweetSyncTweet(fastify, {
        id: tweet.id,
        syncNextTimeTweet: new Date(Date.now() + 1000 * 60 * 5), // Sync again in 5 minutes
      });
      fastify.log.info(
        `[task-sync] Updated reply next token for tweet ${tweet.id}, next token: ${nextToken}`
      );
    } else {
      await this.degovService.updateDegovTweetSyncTweet(fastify, {
        id: tweet.id,
        syncNextTimeTweet: new Date(Date.now() + 1000 * 60 * 10), // Sync again in 10 minutes
      });
      fastify.log.info(
        `[task-sync] No next token for tweet ${tweet.id}, wait 10 minutes reply sync.`
      );
    }
  }
}
