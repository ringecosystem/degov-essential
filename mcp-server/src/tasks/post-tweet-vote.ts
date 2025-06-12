import { FastifyInstance } from "fastify";
import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";
import { Service } from "typedi";
import { EnvReader } from "../integration/env-reader";

@Service()
export class PostTweetNewVoteTask {
  constructor() {}

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

  }
}
