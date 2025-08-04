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
import { GovernorContract } from "../internal/governor";
import { ChainTool } from "../internal/chaintool";

@Service()
export class DegovProposalNewTask {
  constructor(
    private readonly daoService: DaoService,
    private readonly twitterAgent: TwitterAgentW,
    private readonly openrouterAgent: OpenrouterAgent,
    private readonly degovIndexer: DegovIndexer,
    private readonly governorContract: GovernorContract,
    private readonly chainTool: ChainTool
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
      // const voteEnd = new Date(+proposal.voteEnd * 1000);
      const calcOptions = {
        proposalVoteStart: proposal.voteStart,
        proposalVoteEnd: proposal.voteEnd,
        proposalCreatedBlock: proposal.blockNumber,
        proposalStartTimestamp: proposal.blockTimestamp,
        clockMode: event.clockMode,
        blockInterval: event.blockInterval,
      };
      const pollTweetDurationResult =
        DegovHelpers.calculatePollTweetDurationMinutes(calcOptions);
      fastify.log.debug(
        `[task-new] pollTweetDurationResult: ${JSON.stringify(
          pollTweetDurationResult
        )} by options: ${JSON.stringify(calcOptions)}`
      );

      if (
        pollTweetDurationResult.durationMinutes &&
        pollTweetDurationResult.durationMinutes < 0
      ) {
        await this.daoService.updateProgress(fastify, {
          code: event.daocode,
          lastBlockNumber: proposal.blockNumber,
        });
        fastify.log.info(
          `[task-new] Skipping proposal tweet for DAO: ${event.daoname}, Proposal ID: ${proposal.id} - Vote ended in the past.`
        );
        continue;
      }
      if (proposal.description.toLowerCase().includes("[no-agent]")) {
        await this.daoService.updateProgress(fastify, {
          code: event.daocode,
          lastBlockNumber: proposal.blockNumber,
        });
        fastify.log.info(
          `[task-new] Skipping proposal tweet for DAO: ${event.daoname}, Proposal ID: ${proposal.id} - [no-agent] tag found in description.`
        );
        continue;
      }

      const stu = this.twitterAgent.currentUser({ xprofile: event.xprofile });
      let tweetInput: SendTweetInput | undefined;
      if (!pollTweetDurationResult.durationMinutes) {
        const promptout = await DegovPrompt.newExpiringSoonProposalTweet(
          fastify,
          {
            stu,
            event,
            voteEnd: pollTweetDurationResult.proposalEndTimestamp,
            durationMinutes: pollTweetDurationResult.durationMinutes,
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
            duration_minutes: pollTweetDurationResult.durationMinutes,
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
      const daox = DegovHelpers.extractXName(degovConfig.links?.twitter);
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

      const chainRpc = await this.chainTool.pickRpc({
        rpcs: degovConfig.chain?.rpcs,
      });
      const clockMode = await this.governorContract.clockMode({
        chainId,
        endpoint: chainRpc,
        contractAddress: degovConfig.contracts?.governor as `0x${string}`,
      });
      fastify.log.debug(
        `[task-new] Picked clock mode for DAO ${dao.code}: ${clockMode}`
      );
      const blockInterval = await this.chainTool.blockInterval(fastify, {
        chainId,
        endpoint: chainRpc,
        enableFloatValue: true,
      });
      fastify.log.debug(
        `[task-new] Block interval for DAO ${dao.code}: ${blockInterval}`
      );

      const degovLink = DegovHelpers.degovLink(degovConfig);
      for (const proposal of proposals) {
        const proposalLink = degovLink.proposal(proposal.proposalId);
        const npe: NewProposalEvent = {
          xprofile: dao.xprofile,
          daocode: dao.code,
          daoname: degovConfig.name,
          daox: daox,
          carry: dao.carry,
          clockMode: clockMode,
          blockInterval: blockInterval,
          proposal: {
            id: proposal.proposalId,
            chainId,
            url: proposalLink,
            voteStart: parseInt(proposal.voteStart),
            voteEnd: parseInt(proposal.voteEnd),
            description: proposal.description,
            blockNumber: parseInt(proposal.blockNumber),
            blockTimestamp: parseInt(proposal.blockTimestamp),
            transactionHash: proposal.transactionHash,
            transactionLink: degovLink.transaction(proposal.transactionHash),
          },
        };
        results.push(npe);
      }
    }

    return results;
  }
}
