import { FastifyInstance } from "fastify";
import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";
import { Service } from "typedi";
import { EnvReader } from "../integration/env-reader";
import { DegovService } from "../services/degov";
import { DegovIndexerProposal } from "../internal/graphql";
import { DaoService } from "../services/dao";
import { TwitterAgentW } from "../internal/x-agent/agentw";
import { SendTweetInput } from "../internal/x-agent";
import { DegovTweetStatus } from "../types";

@Service()
export class PostTweetProposalCanceledTask {
  constructor(
    private readonly degovService: DegovService,
    private readonly twitterAgent: TwitterAgentW,
    private readonly daoService: DaoService,
    private readonly degovIndexerProposal: DegovIndexerProposal
  ) {}

  async start(fastify: FastifyInstance) {
    const task = new AsyncTask(
      "task-post-tweet-proposal-canceled",
      async () => {
        try {
          const enableFeature = EnvReader.envBool(
            "FEATURE_POST_TWEET_PROPOSAL_CANCELED",
            {
              defaultValue: "true",
            }
          );
          if (!enableFeature) {
            fastify.log.warn(
              "FEATURE_POST_TWEET_PROPOSAL_CANCELED is disabled, skipping task."
            );
            return;
          }

          await this.run(fastify);
        } catch (err) {
          fastify.log.error(err);
        }
      }
    );
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
    const maybeCanceledTweets = await this.degovService.listCheckCanceledTweets(
      fastify
    );
    for (const maybeCanceledTweet of maybeCanceledTweets) {
      const dao = await this.daoService.dao(fastify, {
        daocode: maybeCanceledTweet.daocode,
      });
      if (!dao) {
        fastify.log.warn(
          `DAO not found for tweet ${maybeCanceledTweet.id}, skipping tweet processing.`
        );
        return;
      }
      const stu = this.twitterAgent.currentUser({ xprofile: dao.xprofile });
      const canceledProposal =
        await this.degovIndexerProposal.queryProposalCanceled({
          endpoint: dao.links.indexer,
          proposalId: maybeCanceledTweet.proposal_id,
        });
      if (!canceledProposal) {
        fastify.log.info(
          `No canceled proposal found for tweet ${maybeCanceledTweet.id}.`
        );
        continue;
      }

      const promptInput = {
        proposalLink: `${dao.links.website}/proposal/${maybeCanceledTweet.proposal_id}`,
      };

      const tweet = [
        "❌ this proposal has been canceled",
        `👉 More details: ${promptInput.proposalLink}`,
      ].join("\n");

      const tweetInput: SendTweetInput = {
        xprofile: dao.xprofile,
        daocode: maybeCanceledTweet.daocode,
        proposalId: maybeCanceledTweet.proposal_id,
        chainId: maybeCanceledTweet.chain_id,
        text: tweet,
        reply: {
          in_reply_to_tweet_id: maybeCanceledTweet.id,
        },
      };

      const sendResp = await this.twitterAgent.sendTweet(fastify, tweetInput);
      fastify.log.info(
        `Tweet sent for canceled proposal https://x.com/${stu.username}/status/${sendResp.data.id}`
      );
      await this.degovService.updateTweetStatus(fastify, {
        proposalId: maybeCanceledTweet.proposal_id,
        status: DegovTweetStatus.Canceled,
      });
    }
  }
}
