import { FastifyInstance } from "fastify";
import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";
import { Service } from "typedi";
import { DaoService } from "../services/dao";
import { TwitterAgentW } from "../internal/x-agent/agentw";
import { SendTweetInput } from "../internal/x-agent";
import { OpenrouterAgent } from "../internal/openrouter";
import { setTimeout } from "timers/promises";
import { PromptProposal } from "../internal/prompt";
import { EnvReader } from "../integration/env-reader";
import { DegovTweetStatus, NewProposalEvent } from "../types";
import { DegovIndexerProposal } from "../internal/graphql";
import { DegovService } from "../services/degov";
import { DegovHelpers } from "../helpers";

@Service()
export class PostTweetProposalExecutedTask {
  constructor(
    private readonly degovService: DegovService,
    private readonly daoService: DaoService,
    private readonly twitterAgent: TwitterAgentW,
    private readonly degovIndexerProposal: DegovIndexerProposal
  ) {}

  async start(fastify: FastifyInstance) {
    const task = new AsyncTask(
      "task-post-tweet-proposal-executed",
      async () => {
        try {
          const enableFeature = EnvReader.envBool(
            "FEATURE_POST_TWEET_PROPOSAL_EXECUTED",
            {
              defaultValue: "true",
            }
          );
          if (!enableFeature) {
            fastify.log.warn(
              "FEATURE_POST_TWEET_PROPOSAL_EXECUTED is disabled, skipping task."
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
    const queuedTweets = await this.degovService.listPollTweetsByStatus(fastify, {
      status: DegovTweetStatus.Queued,
    });

    for (const queuedTweet of queuedTweets) {
      const dao = await this.daoService.dao(fastify, {
        daocode: queuedTweet.daocode,
      });
      if (!dao) {
        fastify.log.warn(
          `DAO not found for tweet ${queuedTweet.id}, skipping tweet processing.`
        );
        return;
      }
      const stu = this.twitterAgent.currentUser({ xprofile: dao.xprofile });
      const executedProposal =
        await this.degovIndexerProposal.queryProposalExecuted({
          endpoint: dao.links.indexer,
          proposalId: queuedTweet.proposal_id,
        });
      if (!executedProposal) {
        fastify.log.info(
          `No queued proposal found for tweet ${queuedTweet.id}.`
        );
        continue;
      }

      const promptInput = {
        transactionLink: DegovHelpers.explorerLink(
          dao.config?.chain?.explorers
        ).transaction(executedProposal.transactionHash),
        proposalLink: `${dao.links.website}/proposal/${queuedTweet.proposal_id}`,
      };
      const tweet = [
        "✅ This proposal executed!",
        "🫶 The changes are now live. Thanks to everyone who participated in the vote!",
        ...(promptInput.transactionLink
          ? [`🔗 Transaction: ${promptInput.transactionLink}`]
          : []),
        `👉 See the results: ${promptInput.proposalLink}`,
      ].join("\n");

      const tweetInput: SendTweetInput = {
        xprofile: dao.xprofile,
        daocode: queuedTweet.daocode,
        proposalId: queuedTweet.proposal_id,
        chainId: queuedTweet.chain_id,
        text: tweet,
        reply: {
          in_reply_to_tweet_id: queuedTweet.id,
        },
      };

      const sendResp = await this.twitterAgent.sendTweet(fastify, tweetInput);
      fastify.log.info(
        `Posted executed proposal tweet(https://x.com/${stu.username}/status/${sendResp.data.id}) for DAO: ${dao.name}, Proposal URL: ${promptInput.proposalLink}`
      );

      await this.degovService.updateTweetStatus(fastify, {
        proposalId: queuedTweet.proposal_id,
        status: DegovTweetStatus.Queued,
      });
    }
  }
}
