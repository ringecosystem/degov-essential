import { FastifyInstance } from "fastify";
import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";
import { Service } from "typedi";
import { EnvReader } from "../integration/env-reader";
import { GovernorContract } from "../internal/governor";
import { DegovService } from "../services/degov";
import { DegovMcpDao, ProposalState } from "../types";
import { degov_tweet } from "../generated/prisma";
import { DaoService } from "../services/dao";
import { DegovHelpers } from "../helpers";
import { SendTweetInput } from "../internal/x-agent";
import { TwitterAgentW } from "../internal/x-agent/agentw";
import { DegovIndexerProposal } from "../internal/graphql";

@Service()
export class DegovProposalStatusTask {
  constructor(
    private readonly degovService: DegovService,
    private readonly daoService: DaoService,
    private readonly governorContract: GovernorContract,
    private readonly twitterAgent: TwitterAgentW,
    private readonly degovIndexerProposal: DegovIndexerProposal
  ) {}

  async start(fastify: FastifyInstance) {
    const task = new AsyncTask("task-proposal-status", async () => {
      try {
        const enableFeature = EnvReader.envBool(
          "FEATURE_TASK_PROPOSAL_STATUS",
          {
            defaultValue: "true",
          }
        );
        if (!enableFeature) {
          fastify.log.warn(
            "FEATURE_TASK_PROPOSAL_STATUS is disabled, skipping task."
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
    const trackTweets = await this.degovService.listPollTweetsByStatus(
      fastify,
      {
        status: [
          ProposalState.Pending,
          ProposalState.Active,
          ProposalState.Succeeded,
          ProposalState.Queued,
        ],
      }
    );
    for (const trackTweet of trackTweets) {
      try {
        const dao = await this.daoService.dao(fastify, {
          daocode: trackTweet.daocode,
        });
        if (!dao) {
          fastify.log.warn(
            `DAO not found for tweet ${trackTweet.id}, skipping tweet processing.`
          );
          continue;
        }
        await this.fetchStatus(fastify, {
          degovTweet: trackTweet,
          dao,
        });
      } catch (err) {
        fastify.log.error(
          `Error fetching status for tweet ${trackTweet.id}: ${err}`
        );
      }
    }
  }

  private async fetchStatus(
    fastify: FastifyInstance,
    options: {
      degovTweet: degov_tweet;
      dao: DegovMcpDao;
    }
  ) {
    const { degovTweet, dao } = options;
    const daoConfig = dao.config;
    if (!daoConfig) {
      throw new Error(`DAO config not found for DAO ${dao.code}.`);
    }
    const daoContracts = daoConfig.contracts;
    const stu = this.twitterAgent.currentUser({ xprofile: dao.xprofile });

    const result = await this.governorContract.status({
      chainId: daoConfig.chain.id,
      endpoint: daoConfig.chain.rpcs?.[0],
      contractAddress: DegovHelpers.stdHex(daoContracts.governor),
      proposalId: degovTweet.proposal_id,
    });
    if (degovTweet.status === result) {
      fastify.log.info(
        `No status change for tweet ${degovTweet.id} (proposal ID: ${degovTweet.proposal_id}), current status: ${result}`
      );
      return; // No status change, skip further processing
    }

    await this.degovService.updateTweetStatus(fastify, {
      proposalId: degovTweet.proposal_id,
      status: result,
    });

    const promptInput = {
      proposalLink: `${dao.links.website}/proposal/${degovTweet.proposal_id}`,
    };

    const moreInfos: string[] = [];
    try {
      const moreInfosResult = await this.moreTweetInfos({
        degovTweet,
        dao,
        status: result,
      });
      if (moreInfosResult.length > 0) {
        moreInfos.push(...moreInfosResult);
      }
    } catch (err) {
      fastify.log.warn(
        `Error fetching more tweet infos for tweet ${degovTweet.id}: ${err}`
      );
    }

    const tweet = [
      `${this.bestStatusEmoji(result)} This proposal ${result}`,
      ...moreInfos,
      `👉 Follow on DeGov ${promptInput.proposalLink}`,
    ].join("\n");

    const tweetInput: SendTweetInput = {
      xprofile: dao.xprofile,
      daocode: degovTweet.daocode,
      proposalId: degovTweet.proposal_id,
      chainId: degovTweet.chain_id,
      text: tweet,
      reply: {
        in_reply_to_tweet_id: degovTweet.id,
      },
    };

    const sendResp = await this.twitterAgent.sendTweet(fastify, tweetInput);
    fastify.log.info(
      `Posted proposal status tweet(https://x.com/${stu.username}/status/${sendResp.data.id}) for DAO: ${dao.name}, Proposal URL: ${promptInput.proposalLink}`
    );
  }

  private async moreTweetInfos(options: {
    degovTweet: degov_tweet;
    dao: DegovMcpDao;
    status: ProposalState;
  }): Promise<string[]> {
    const results = [];
    let transactionHash: string | undefined;
    switch (options.status) {
      case ProposalState.Canceled:
        const pcanceled = await this.degovIndexerProposal.queryProposalCanceled(
          {
            endpoint: options.dao.links.indexer,
            proposalId: options.degovTweet.proposal_id,
          }
        );
        transactionHash = pcanceled?.transactionHash;
        break;
      case ProposalState.Queued:
        const pqueued = await this.degovIndexerProposal.queryProposalQueued({
          endpoint: options.dao.links.indexer,
          proposalId: options.degovTweet.proposal_id,
        });
        transactionHash = pqueued?.transactionHash;
        if (pqueued) {
          const etaSeconds = +pqueued.etaSeconds;
          const etaDate = new Date(
            Date.now() + etaSeconds * 1000
          ).toISOString();
          results.push(`📅 ETA: ${etaDate}`);
        }
        break;
      case ProposalState.Executed:
        const pexecuted = await this.degovIndexerProposal.queryProposalExecuted(
          {
            endpoint: options.dao.links.indexer,
            proposalId: options.degovTweet.proposal_id,
          }
        );
        transactionHash = pexecuted?.transactionHash;
        break;

      case ProposalState.Pending:
      case ProposalState.Active:
      case ProposalState.Defeated:
      case ProposalState.Succeeded:
      case ProposalState.Expired:
      default:
        return [];
    }
    const transactionLink = DegovHelpers.explorerLink(
      options.dao.config?.chain?.explorers
    ).transaction(transactionHash);
    results.push(
      ...(transactionLink ? [`🔗 Transaction: ${transactionLink}`] : [])
    );
    return results;
  }

  private bestStatusEmoji(status: ProposalState): string {
    switch (status) {
      case ProposalState.Pending:
        return "⏳";
      case ProposalState.Active:
        return "🗳️";
      case ProposalState.Canceled:
        return "❌";
      case ProposalState.Defeated:
        return "💔";
      case ProposalState.Succeeded:
        return "🎉";
      case ProposalState.Queued:
        return "🚶";
      case ProposalState.Expired:
        return "🍂";
      case ProposalState.Executed:
        return "🏁";
      default:
        return "❓"; // Unknown status
    }
  }
}
