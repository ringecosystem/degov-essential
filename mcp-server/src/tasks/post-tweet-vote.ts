import { FastifyInstance } from "fastify";
import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";
import { Service } from "typedi";
import { EnvReader } from "../integration/env-reader";
import { DegovService } from "../services/degov";
import { degov_tweet } from "../generated/prisma";

@Service()
export class PostTweetNewVoteTask {
  constructor(private readonly degovService: DegovService) {}

  async start(fastify: FastifyInstance) {
    const task = new AsyncTask("task-post-tweet-new-vote", async () => {
      try {
        const enableFeature = EnvReader.envBool("FEATURE_POST_TWEET_NEW_VOTE", {
          defaultValue: "true",
        });
        if (!enableFeature) {
          fastify.log.warn(
            "FEATURE_POST_TWEET_NEW_VOTE is disabled, skipping task."
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
    while (true) {
      const tweets = await this.degovService.nextCheckVoteTweets(fastify, {
        limit: 10,
      });
      if (tweets.length === 0) {
        fastify.log.info("No tweets to process, waiting for next cycle.");
        break; // Exit the loop if no tweets are found
      }
      for (const tweet of tweets) {
        try {
          await this.processTweet(fastify, tweet);
        } catch (err) {
          const times_processed = tweet.times_processed + 1;
          const messages = [];
          messages.push(
            `[${times_processed}] Error processing tweet ${tweet.id}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
          if (tweet.message) {
            messages.push(tweet.message);
          }
          const message = messages.join("========");

          fastify.log.error(message);
          await this.degovService.updateProcessError(fastify, {
            id: tweet.id,
            times: times_processed,
            message,
          });
        }
      }
    }
  }

  private async processTweet(fastify: FastifyInstance, tweet: degov_tweet) {
    
  }
}
