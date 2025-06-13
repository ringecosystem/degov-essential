import { FastifyInstance } from "fastify";
import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";
import { Service } from "typedi";
import { EnvReader } from "../integration/env-reader";
import { DegovService } from "../services/degov";
import { DaoService } from "../services/dao";
import { TwitterAgentW } from "../internal/x-agent/agentw";
import { DegovIndexerProposal } from "../internal/graphql";
import { DegovHelpers } from "../helpers";
import { SendTweetInput } from "../internal/x-agent";
import { DegovTweetStatus } from "../types";

@Service()
export class DegovProposalQueuedTask {
  constructor(
    private readonly degovService: DegovService,
    private readonly daoService: DaoService,
    private readonly twitterAgent: TwitterAgentW,
    private readonly degovIndexerProposal: DegovIndexerProposal
  ) {}

  async start(fastify: FastifyInstance) {
    const task = new AsyncTask("task-post-tweet-proposal-queued", async () => {
      try {
        const enableFeature = EnvReader.envBool(
          "FEATURE_TASK_PROPOSAL_QUEUED",
          {
            defaultValue: "true",
          }
        );
        if (!enableFeature) {
          fastify.log.warn(
            "FEATURE_TASK_PROPOSAL_QUEUED is disabled, skipping task."
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
    const postedTweets = await this.degovService.listPollTweetsByStatus(fastify, {
      status: DegovTweetStatus.Posted,
    });

    for (const postedTweet of postedTweets) {
      const dao = await this.daoService.dao(fastify, {
        daocode: postedTweet.daocode,
      });
      if (!dao) {
        fastify.log.warn(
          `DAO not found for tweet ${postedTweet.id}, skipping tweet processing.`
        );
        return;
      }
      const stu = this.twitterAgent.currentUser({ xprofile: dao.xprofile });
      const queuedProposal =
        await this.degovIndexerProposal.queryProposalQueued({
          endpoint: dao.links.indexer,
          proposalId: postedTweet.proposal_id,
        });
      if (!queuedProposal) {
        fastify.log.info(
          `No queued proposal found for tweet ${postedTweet.id}.`
        );
        continue;
      }

      const promptInput = {
        transactionLink: DegovHelpers.explorerLink(
          dao.config?.chain?.explorers
        ).transaction(queuedProposal.transactionHash),
        proposalLink: `${dao.links.website}/proposal/${postedTweet.proposal_id}`,
      };

      const etaSeconds = +queuedProposal.etaSeconds;
      const etaDate = new Date(Date.now() + etaSeconds * 1000).toISOString();
      const tweet = [
        "⏳ This proposal queued for execution",
        `📅 ETA: ${etaDate}`,
        ...(promptInput.transactionLink
          ? [`🔗 Transaction: ${promptInput.transactionLink}`]
          : []),
        `👉 Stay tuned for updates! ${promptInput.proposalLink}`,
      ].join("\n");

      const tweetInput: SendTweetInput = {
        xprofile: dao.xprofile,
        daocode: postedTweet.daocode,
        proposalId: postedTweet.proposal_id,
        chainId: postedTweet.chain_id,
        text: tweet,
        reply: {
          in_reply_to_tweet_id: postedTweet.id,
        },
      };

      const sendResp = await this.twitterAgent.sendTweet(fastify, tweetInput);
      fastify.log.info(
        `Posted queued proposal tweet(https://x.com/${stu.username}/status/${sendResp.data.id}) for DAO: ${dao.name}, Proposal URL: ${promptInput.proposalLink}`
      );

      await this.degovService.updateTweetStatus(fastify, {
        proposalId: postedTweet.proposal_id,
        status: DegovTweetStatus.Queued,
      });
    }
  }
}
