import { FastifyInstance } from "fastify";
import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";
import { Service } from "typedi";
import { EnvReader } from "../integration/env-reader";
import { DegovService } from "../services/degov";
import { degov_tweet } from "../generated/prisma";
import { DegovIndexer } from "../internal/graphql";
import { DaoService } from "../services/dao";
import { OpenrouterAgent } from "../internal/openrouter";
import { DegovPrompt } from "../internal/prompt";
import { TwitterAgentW } from "../internal/x-agent/agentw";
import { DegovHelpers } from "../helpers";
import { SendTweetInput } from "../internal/x-agent";
import { setTimeout } from "timers/promises";
import { generateText } from "ai";

@Service()
export class DegovProposalVoteTask {
  constructor(
    private readonly degovService: DegovService,
    private readonly twitterAgent: TwitterAgentW,
    private readonly daoService: DaoService,
    private readonly degovIndexer: DegovIndexer,
    private readonly openrouterAgent: OpenrouterAgent
  ) {}

  async start(fastify: FastifyInstance) {
    const task = new AsyncTask("task-proposal-vote", async () => {
      try {
        const enableFeature = EnvReader.envBool("FEATURE_TASK_PROPOSAL_VOTE", {
          defaultValue: "true",
        });
        if (!enableFeature) {
          fastify.log.warn(
            "[task-vote] FEATURE_TASK_PROPOSAL_VOTE is disabled, skipping task."
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
      const queryLimit = 10;
      const tweets = await this.degovService.nextCheckVoteTweets(fastify, {
        limit: queryLimit,
      });
      if (tweets.length === 0) {
        fastify.log.info(
          "[task-vote] No tweets to process, waiting for next cycle."
        );
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
      if (tweets.length < queryLimit) {
        fastify.log.info(
          "[task-vote] Processed all available tweets, exiting loop and waiting for next cycle."
        );
        break; // Exit the loop if fewer tweets than limit were found
      }
    }
  }

  private async processTweet(
    fastify: FastifyInstance,
    degovTweet: degov_tweet
  ) {
    const { daocode } = degovTweet;
    const dao = await this.daoService.dao(fastify, {
      daocode: daocode,
    });
    if (!dao) {
      fastify.log.warn(
        `[task-vote] DAO with code ${daocode} not found for tweet ${degovTweet.id}, skipping.`
      );
      return;
    }
    const currentVoteProgress = await this.degovService.currentVoteProgress(
      fastify,
      {
        proposalId: degovTweet.proposal_id,
      }
    );
    const offset = currentVoteProgress?.offset ?? 0;
    const voteCasts = await this.degovIndexer.queryProposalVotes({
      endpoint: dao.links.indexer,
      proposalId: degovTweet.proposal_id,
      offset,
    });
    let nextOffset = offset;
    const stu = this.twitterAgent.currentUser({ xprofile: dao.xprofile });
    for (const vote of voteCasts) {
      try {
        const promptInput = {
          stu,
          voterAddressLink: `${dao.links.website}/delegate/${vote.voter}`,
          proposalLink: `${dao.links.website}/proposal/${
            degovTweet.proposal_id
          }#${DegovHelpers.shortHash(vote.voter)}`,
          transactionLink: DegovHelpers.explorerLink(
            dao.config?.chain?.explorers
          ).transaction(vote.transactionHash),
          choice: DegovHelpers.voteSupportText(vote.support),
          reason: vote.reason ?? "",
        };
        console.log(promptInput);
        const promptout = await DegovPrompt.newVoteCastTweet(
          fastify,
          promptInput
        );

        const aiResp = await generateText({
          model: this.openrouterAgent.openrouter(EnvReader.aiModel()),
          system: promptout.system,
          prompt: promptout.prompt,
        });
        // const tweet = [
        //   `🗳️ Vote cast by ${promptInput.voterAddressLink}`,
        //   "",
        //   `🎯 Choice: ${promptInput.choice}`,
        //   ...(promptInput.reason ? [`💬 Reason: ${promptInput.reason}`] : []),
        //   `🔗 Transaction: ${promptInput.transactionLink}`,
        //   "",
        //   `👉 ${promptInput.proposalLink}`,
        // ].join("\n");

        const tweetInput: SendTweetInput = {
          xprofile: dao.xprofile,
          daocode: degovTweet.daocode,
          proposalId: degovTweet.proposal_id,
          chainId: degovTweet.chain_id,
          text: aiResp.text,
          reply: {
            in_reply_to_tweet_id: degovTweet.id,
          },
        };

        fastify.log.debug(tweetInput);
        const sendResp = await this.twitterAgent.sendTweet(fastify, tweetInput);
        fastify.log.info(
          `[task-vote] Posted new vote cast tweet(https://x.com/${stu.username}/status/${sendResp.data.id}) for DAO: ${dao.name}, Proposal ID: ${degovTweet.proposal_id}`
        );
        await setTimeout(1000);
        nextOffset += 1;
      } catch (error) {
        fastify.log.error(
          `[task-vote] Error processing vote cast for tweet ${
            degovTweet.id
          }: ${DegovHelpers.helpfulErrorMessage(error)}`
        );
      }
    }

    if (currentVoteProgress) {
      await this.degovService.modifyVoteProgress(fastify, {
        proposal_id: currentVoteProgress.proposal_id,
        offset: nextOffset,
      });
    } else {
      await this.degovService.modifyVoteProgress(fastify, {
        daocode: dao.code,
        proposal_id: degovTweet.proposal_id,
        chain_id: degovTweet.chain_id,
        offset: nextOffset,
      });
    }
  }
}
