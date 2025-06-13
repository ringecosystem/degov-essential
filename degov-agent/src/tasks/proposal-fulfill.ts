import { FastifyInstance } from "fastify";
import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";
import { Service } from "typedi";
import { EnvReader } from "../integration/env-reader";
import { DegovService } from "../services/degov";
import { degov_tweet } from "../generated/prisma";
import { DaoService } from "../services/dao";
import { DegovMcpDao } from "../types";
import { TwitterService } from "../services/twitter";

@Service()
export class DegovProposalFulfillTask {
  constructor(
    private readonly degovService: DegovService,
    private readonly twitterService: TwitterService,
    private readonly daoService: DaoService
  ) {}

  async start(fastify: FastifyInstance) {
    const task = new AsyncTask("task-fulfill-tweet-poll", async () => {
      try {
        const enableFeature = EnvReader.envBool("FEATURE_FULFILL_TWEET_POLL", {
          defaultValue: "true",
        });
        if (!enableFeature) {
          fastify.log.warn(
            "FEATURE_FULFILL_TWEET_POLL is disabled, skipping task."
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
        await this.fulfillTweetPoll(fastify, {
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

        fastify.log.error(message);
        await this.degovService.updateProcessError(fastify, {
          id: unfulfilledTweet.id,
          times: times_processed,
          message,
        });
        continue;
      }
    }
  }

  private async fulfillTweetPoll(
    fastify: FastifyInstance,
    options: {
      tweet: degov_tweet;
      dao: DegovMcpDao;
    }
  ) {
    const { tweet, dao } = options;
    // const poll = await this.degovService.getTweetPoll(fastify, {
    //   tweetId: tweet.id,
    // });

    const fullPoll = await this.twitterService.queryPoll(fastify, {
      tweetId: tweet.id,
    });
    const fullTweet = await this.twitterService.getTweetById(fastify, {
      id: tweet.id,
      includeReplies: true,
    });

    console.log("===> ", fullPoll);
    console.log("===> ", fullTweet);
  }
}
