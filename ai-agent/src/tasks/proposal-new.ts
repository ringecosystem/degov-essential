import { FastifyInstance } from "fastify";
import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";
import { Service } from "typedi";
import { DaoService } from "../services/dao";
import { TwitterAgentW } from "../internal/x-agent/agentw";
import { SendTweetInput } from "../internal/x-agent";
import { OpenrouterAgent } from "../internal/openrouter";
import { setTimeout } from "timers/promises";
import { DegovPrompt } from "../internal/prompt";
import { EnvReader } from "../integration/env-reader";
import { NewProposalEvent } from "../types";
import { DegovIndexer } from "../internal/graphql";
import { DegovHelpers } from "../helpers";
import { generateText } from "ai";

@Service()
export class DegovProposalNewTask {
  constructor(
    private readonly daoService: DaoService,
    private readonly twitterAgent: TwitterAgentW,
    private readonly openrouterAgent: OpenrouterAgent,
    private readonly degovIndexer: DegovIndexer
  ) {}

  async start(fastify: FastifyInstance) {
    const task = new AsyncTask("task-proposal-new", async () => {
      try {
        const enableFeature = EnvReader.envBool("FEATURE_TASK_PROPOSAL_NEW", {
          defaultValue: "true",
        });
        if (!enableFeature) {
          fastify.log.warn(
            "[task-new] FEATURE_TASK_PROPOSAL_NEW is disabled, skipping task."
          );
          return;
        }

        await this.run(fastify);
      } catch (err) {
        fastify.log.error(
          `[task-new] Error in ProposalNewTask: ${DegovHelpers.helpfulErrorMessage(
            err,
            { printTrace: true }
          )}`
        );
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
    const events = await this.nextNewProposals(fastify);
    for (const event of events) {
      const proposal = event.proposal;
      const voteEnd = new Date(+proposal.voteEnd * 1000);
      const durationMinutes = DegovHelpers.calculatePollTweetDurationMinutes({
        proposalVoteEnd: voteEnd,
      });

      if (durationMinutes && durationMinutes < 0) {
        await this.daoService.updateProgress(fastify, {
          code: event.daocode,
          lastBlockNumber: proposal.blockNumber,
        });
        fastify.log.info(
          `[task-new] Skipping proposal tweet for DAO: ${event.daoname}, Proposal ID: ${proposal.id} - Vote ended in the past.`
        );
        continue;
      }

      const stu = this.twitterAgent.currentUser({ xprofile: event.xprofile });
      let tweetInput: SendTweetInput | undefined;
      if (!durationMinutes) {
        const promptout = await DegovPrompt.newExpiringSoonProposalTweet(
          fastify,
          {
            stu,
            event,
            voteEnd,
            durationMinutes: durationMinutes,
          }
        );
        const aiResp = await generateText({
          model: this.openrouterAgent.openrouter(EnvReader.aiModel()),
          system: promptout.system,
          prompt: promptout.prompt,
        });
        tweetInput = {
          xprofile: event.xprofile,
          daocode: event.daocode,
          proposalId: proposal.id,
          chainId: proposal.chainId,
          text: aiResp.text,
        };
      } else {
        const promptout = await DegovPrompt.newProposalTweet(fastify, {
          stu,
          event,
        });
        const aiResp = await generateText({
          model: this.openrouterAgent.openrouter(EnvReader.aiModel()),
          system: promptout.system,
          prompt: promptout.prompt,
        });

        tweetInput = {
          xprofile: event.xprofile,
          daocode: event.daocode,
          proposalId: proposal.id,
          chainId: proposal.chainId,
          text: aiResp.text,
          poll: {
            options: ["For", "Against", "Abstain"],
            duration_minutes: durationMinutes,
          },
        };
      }

      console.log(tweetInput);
      const sendResp = await this.twitterAgent.sendTweet(fastify, tweetInput);
      fastify.log.info(
        `[task-new] Posted new proposal tweet(https://x.com/${stu.username}/status/${sendResp.data.id}) for DAO: ${event.daoname}, Proposal URL: ${proposal.url}`
      );
      await this.daoService.updateProgress(fastify, {
        code: event.daocode,
        lastBlockNumber: proposal.blockNumber,
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
      const degovConfig = dao.config;
      const chainId = degovConfig.chain?.id;
      if (!chainId) {
        fastify.log.warn(
          `[task-new] Chain ID not found for DAO ${degovConfig.name}. Skipping proposal processing.`
        );
        continue;
      }
      let daox = degovConfig.links?.twitter;
      if (daox) {
        daox = daox.substring(daox.lastIndexOf("/") + 1);
        daox = daox.substring(
          0,
          daox.indexOf("?") > -1 ? daox.indexOf("?") : daox.length
        );
      }
      const proposals = await this.degovIndexer.queryNextProposals({
        endpoint: degovConfig.indexer.endpoint,
        lastBlockNumber: dao.lastProcessedBlock ?? 0,
      });
      if (!proposals || !proposals.length) {
        fastify.log.info(
          `[task-new] No new proposals found for DAO ${degovConfig.name} with code ${dao.code}.`
        );
        continue; // No new proposals found
      }
      for (const proposal of proposals) {
        const npe: NewProposalEvent = {
          xprofile: dao.xprofile,
          daocode: dao.code,
          daoname: degovConfig.name,
          daox: daox,
          carry: dao.carry,
          proposal: {
            id: proposal.proposalId,
            chainId,
            url: `${degovConfig.links?.website}/proposal/${proposal.proposalId}`,
            voteStart: parseInt(proposal.voteStart),
            voteEnd: parseInt(proposal.voteEnd),
            description: proposal.description,
            blockNumber: parseInt(proposal.blockNumber),
            blockTimestamp: parseInt(proposal.blockTimestamp),
            transactionHash: proposal.transactionHash,
            transactionLink: DegovHelpers.explorerLink(
              dao.config?.chain?.explorers
            ).transaction(proposal.transactionHash),
          },
        };
        results.push(npe);
      }
    }

    return results;
  }
}
