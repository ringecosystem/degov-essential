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
import { NewProposalEvent } from "../types";
import { DegovIndexerProposal } from "../internal/graphql";
import { DegovHelpers } from "../helpers";

@Service()
export class PostTweetProposalNewTask {
  constructor(
    private readonly daoService: DaoService,
    private readonly twitterAgent: TwitterAgentW,
    private readonly openrouterAgent: OpenrouterAgent,
    private readonly degovIndexerProposal: DegovIndexerProposal
  ) {}

  async start(fastify: FastifyInstance) {
    const task = new AsyncTask("task-post-tweet-proposal-new", async () => {
      try {
        const enableFeature = EnvReader.envBool(
          "FEATURE_POST_TWEET_PROPOSAL_NEW",
          {
            defaultValue: "true",
          }
        );
        if (!enableFeature) {
          fastify.log.warn(
            "FEATURE_POST_TWEET_PROPOSAL_NEW is disabled, skipping task."
          );
          return;
        }

        await this.run(fastify);
      } catch (err) {
        fastify.log.error(
          `Error in PostTweetProposalNewTask: ${DegovHelpers.helpfulErrorMessage(
            err
          )}`
        );
      }
    });
    const job = new SimpleIntervalJob(
      {
        minutes: 5,
        runImmediately: true,
      },
      task
    );
    fastify.ready().then(() => {
      fastify.scheduler.addSimpleIntervalJob(job);
    });
  }

  private async run(fastify: FastifyInstance) {
    const events = await this.nextNewProposals(fastify);
    for (const event of events) {
      const stu = this.twitterAgent.currentUser({ xprofile: event.xprofile });
      const promptout = await PromptProposal.newProposalTweet(fastify, {
        stu,
        event,
      });
      const tweet = await this.openrouterAgent.generateText({
        system: promptout.system,
        prompt: promptout.prompt,
      });
      const proposal = event.proposal;
      const voteEnd = new Date(+proposal.voteEnd * 1000);
      const now = new Date();
      let durationMinutes = 10; // 10 minutes for the poll duration
      const maxDurationMinutes = 7 * 24 * 60; // 7 days in minutes
      if (voteEnd > now) {
        const remainingTimeMinutes = Math.ceil(
          (voteEnd.getTime() - now.getTime()) / 60000
        ); // Convert milliseconds to minutes
        durationMinutes = Math.min(remainingTimeMinutes, maxDurationMinutes);
      }
      const tweetInput: SendTweetInput = {
        xprofile: event.xprofile,
        daocode: event.daocode,
        proposalId: proposal.id,
        chainId: proposal.chainId,
        text: tweet,
        poll: {
          options: ["For", "Against", "Abstain"],
          duration_minutes: durationMinutes,
        },
      };
      const sendResp = await this.twitterAgent.sendTweet(fastify, tweetInput);
      fastify.log.info(
        `Posted new proposal tweet(https://x.com/${stu.username}/status/${sendResp.data.id}) for DAO: ${event.daoname}, Proposal URL: ${proposal.url}`
      );
      await this.daoService.updateProgress(fastify, {
        code: event.daocode,
        lastBlockNumber: event.blockNumber,
      });
      await setTimeout(1000); // Wait for 1 second before processing the next proposal
    }
  }

  private async nextNewProposals(
    fastify: FastifyInstance
  ): Promise<NewProposalEvent[]> {
    const daos = await this.daoService.daos(fastify);
    const results: NewProposalEvent[] = [];

    for (const dao of daos) {
      if (!dao.xprofile) {
        continue;
      }
      const chainId = dao.config?.chain?.id;
      if (!chainId) {
        fastify.log.warn(
          `Chain ID not found for DAO ${dao.name}. Skipping proposal processing.`
        );
        continue;
      }
      const proposal = await this.degovIndexerProposal.queryNextProposal({
        endpoint: dao.links.indexer,
        lastBlockNumber: dao.lastProcessedBlock ?? 0,
      });
      if (!proposal) {
        fastify.log.info(
          `No new proposals found for DAO ${dao.name} with code ${dao.code}.`
        );
        continue; // No new proposals found
      }
      const npe: NewProposalEvent = {
        xprofile: dao.xprofile,
        daocode: dao.code,
        daoname: dao.name,
        blockNumber: parseInt(proposal.blockNumber),
        blockTimestamp: parseInt(proposal.blockTimestamp),
        proposal: {
          id: proposal.proposalId,
          chainId,
          url: `${dao.links.website}/proposal/${proposal.proposalId}`,
          voteStart: parseInt(proposal.voteStart),
          voteEnd: parseInt(proposal.voteEnd),
          description: proposal.description,
        },
      };
      results.push(npe);
    }

    return results;
  }
}
