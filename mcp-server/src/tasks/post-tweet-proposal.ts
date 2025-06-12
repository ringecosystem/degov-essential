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

@Service()
export class PostTweetNewProposalTask {
  constructor(
    private readonly daoService: DaoService,
    private readonly twitterAgent: TwitterAgentW,
    private readonly openrouterAgent: OpenrouterAgent
  ) {}

  async start(fastify: FastifyInstance) {
    const task = new AsyncTask("task-post-tweet-new-proposal", async () => {
      try {
        const enableFeature = EnvReader.envBool(
          "FEATURE_POST_TWEET_NEW_PROPOSAL",
          {
            defaultValue: "true",
          }
        );
        if (!enableFeature) {
          fastify.log.warn(
            "FEATURE_POST_TWEET_NEW_PROPOSAL is disabled, skipping task."
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
    const events = await this.daoService.nextNewProposals(fastify);
    for (const event of events) {
      const stu = this.twitterAgent.currentUser({ xprofile: event.xprofile });
      const promptout = await PromptProposal.newProposalTweet(fastify, {
        event,
        stu,
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
      const input: SendTweetInput = {
        xprofile: event.xprofile,
        proposalId: proposal.id,
        chainId: proposal.chainId,
        text: tweet,
        poll: {
          options: ["For", "Against", "Abstain"],
          duration_minutes: durationMinutes,
        },
      };
      const sendResp = await this.twitterAgent.sendTweet(fastify, input);
      fastify.log.info(
        `Posted new proposal tweet(https://x.com/${stu.username}/status/${sendResp.data.id}) for DAO: ${event.daoname}, Proposal URL: ${proposal.url}`
      );
      await setTimeout(1000); // Wait for 1 second before processing the next proposal
    }
  }
}
