import { DegovHelpers, PollTweetDurationResult } from "../src/helpers";
import { ClockMode } from "../src/types";
import { AgentTestSupport, TweetWriter } from "./support";
import { DegovPrompt } from "../src/internal/prompt";
import Container from "typedi";
import { generateText } from "ai";
import { EnvReader } from "../src/integration/env-reader";
import { SendTweetInput } from "../src/internal/x-agent";
import dotenv from "dotenv";
import { TweetGen } from "../src/internal/tweetgen";

describe("X Tweet Preview Test", () => {
  const ats: AgentTestSupport = Container.get(AgentTestSupport);

  beforeAll(async () => {
    await ats.init();
    dotenv.config();

    // Clear the output file at the start
    await TweetWriter.clearOutputFile();
  });

  afterAll(async () => {
    await ats.close();
  });

  it(
    "Expired proposal",
    async () => {
      const proposalEvent = ats.proposalEvent();
      const { proposal } = proposalEvent;

      const calcOptions = {
        proposalVoteStart: proposal.voteStart,
        proposalVoteEnd: proposal.voteEnd,
        proposalCreatedBlock: proposal.blockNumber,
        proposalStartTimestamp: proposal.blockTimestamp,
        clockMode: ClockMode.Timestamp,
        blockInterval: 6,
      };

      const pollTweetDurationResult =
        DegovHelpers.calculatePollTweetDurationMinutes(calcOptions);

      const fastify = ats.fastify();

      const promptout = await DegovPrompt.newExpiringSoonProposalTweet(
        fastify,
        {
          stu: ats.verifiedXUser(),
          event: proposalEvent,
          voteEnd: pollTweetDurationResult.proposalEndTimestamp,
          durationMinutes: pollTweetDurationResult.durationMinutes,
        }
      );

      const aiResp = await generateText({
        model: ats.openrouterAgent.openrouter(EnvReader.aiModel()),
        system: promptout.system,
        prompt: promptout.prompt,
      });
      const tweetInput: SendTweetInput = {
        xprofile: proposalEvent.xprofile,
        daocode: proposalEvent.daocode,
        proposalId: proposal.id,
        chainId: proposal.chainId,
        text: aiResp.text,
      };
      console.log(pollTweetDurationResult, tweetInput);

      // Write tweet to output file
      await TweetWriter.writeTweet(
        "Expired Proposal Tweet",
        ats.formatSendTweet(tweetInput) +
          `\n\n## 📊 Poll Duration Result\n` +
          `**Duration Minutes**: ${
            pollTweetDurationResult.durationMinutes ?? "N/A"
          }\n` +
          `**Proposal Start**: ${pollTweetDurationResult.proposalStartTimestamp.toISOString()}\n` +
          `**Proposal End**: ${pollTweetDurationResult.proposalEndTimestamp.toISOString()}\n`
      );
    },
    1000 * 60
  );

  it(
    "Expiring soon proposal",
    async () => {
      const proposalEvent = ats.proposalEvent();
      const { proposal } = proposalEvent;

      const fastify = ats.fastify();

      const pollTweetDurationResult: PollTweetDurationResult = {
        durationMinutes: 10,
        proposalStartTimestamp: new Date(),
        proposalEndTimestamp: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes later
      };

      const promptout = await DegovPrompt.newExpiringSoonProposalTweet(
        fastify,
        {
          stu: ats.verifiedXUser(),
          event: proposalEvent,
          voteEnd: pollTweetDurationResult.proposalEndTimestamp,
          durationMinutes: pollTweetDurationResult.durationMinutes,
        }
      );

      const aiResp = await generateText({
        model: ats.openrouterAgent.openrouter(EnvReader.aiModel()),
        system: promptout.system,
        prompt: promptout.prompt,
      });
      const tweetInput: SendTweetInput = {
        xprofile: proposalEvent.xprofile,
        daocode: proposalEvent.daocode,
        proposalId: proposal.id,
        chainId: proposal.chainId,
        text: aiResp.text,
      };
      console.log(pollTweetDurationResult, tweetInput);

      // Write tweet to output file
      await TweetWriter.writeTweet(
        "Expiring Soon Proposal Tweet",
        ats.formatSendTweet(tweetInput) +
          `\n\n## 📊 Poll Duration Result\n` +
          `**Duration Minutes**: ${
            pollTweetDurationResult.durationMinutes ?? "N/A"
          }\n` +
          `**Proposal Start**: ${pollTweetDurationResult.proposalStartTimestamp.toISOString()}\n` +
          `**Proposal End**: ${pollTweetDurationResult.proposalEndTimestamp.toISOString()}\n`
      );
    },
    1000 * 60
  );

  it(
    "New proposal",
    async () => {
      const proposalEvent = ats.proposalEvent();
      const { proposal } = proposalEvent;

      const fastify = ats.fastify();

      const promptout = await DegovPrompt.newProposalTweet(fastify, {
        stu: ats.verifiedXUser(),
        event: proposalEvent,
      });

      const aiResp = await generateText({
        model: ats.openrouterAgent.openrouter(EnvReader.aiModel()),
        system: promptout.system,
        prompt: promptout.prompt,
      });
      const tweetInput: SendTweetInput = {
        xprofile: proposalEvent.xprofile,
        daocode: proposalEvent.daocode,
        proposalId: proposal.id,
        chainId: proposal.chainId,
        text: aiResp.text,
        poll: {
          options: ["For", "Against", "Abstain"],
          duration_minutes: 1440, // 24 hours
        },
      };
      console.log(tweetInput);

      // Write tweet to output file
      await TweetWriter.writeTweet(
        "New Proposal Tweet",
        ats.formatSendTweet(tweetInput)
      );
    },
    1000 * 60
  );

  it(
    "New vote cast tweet",
    async () => {
      const proposalEvent = ats.proposalEvent();
      const { proposal } = proposalEvent;
      const votes = ats.voteEvents();
      const degovLink = ats.degovLink();

      for (const vote of votes) {
        const mixedAccountInfo = ats.mixedAccountInfo(vote.voter);
        const promptInput = {
          stu: ats.verifiedXUser(),
          ensName: mixedAccountInfo?.ensName ?? "",
          voterXUsername: mixedAccountInfo?.xUsername ?? "",
          voterAddress: vote.voter,
          voterAddressLink: degovLink.delegate(vote.voter),
          proposalLink: degovLink.proposal(vote.proposalId),
          transactionLink: degovLink.transaction(vote.transactionHash),
          choice: DegovHelpers.voteSupportText(vote.support),
          reason: vote.reason ?? "",
        };
        const promptout = await DegovPrompt.newVoteCastTweet(
          ats.fastify(),
          promptInput
        );

        const aiResp = await generateText({
          model: ats.openrouterAgent.openrouter(EnvReader.aiModel()),
          system: promptout.system,
          prompt: promptout.prompt,
        });

        const tweetInput: SendTweetInput = {
          xprofile: proposalEvent.xprofile,
          daocode: proposalEvent.daocode,
          proposalId: proposal.id,
          chainId: proposal.chainId,
          text: aiResp.text,
          reply: {
            in_reply_to_tweet_id: proposal.id,
          },
        };
        console.log(tweetInput);

        // Write tweet to output file
        await TweetWriter.writeTweet(
          "New Vote Cast Tweet",
          ats.formatSendTweet(tweetInput)
          // +
          //   `\n\n## 🗳️ Vote Details\n` +
          //   `**Voter Address**: \`${vote.voter}\`\n` +
          //   `**Support**: ${DegovHelpers.voteSupportText(vote.support)} (${
          //     vote.support
          //   })\n` +
          //   `**Weight**: \`${vote.weight}\`\n` +
          //   `**Block Number**: \`${vote.blockNumber}\`\n` +
          //   `**Transaction Hash**: \`${vote.transactionHash}\`\n` +
          //   (vote.reason ? `**Reason**: ${vote.reason}\n` : "") +
          //   `\n## 🔗 Links\n` +
          //   `**Voter Link**: ${promptInput.voterAddressLink}\n` +
          //   `**Proposal Link**: ${promptInput.proposalLink}\n` +
          //   `**Transaction Link**: ${promptInput.transactionLink}\n`
        );
      }
    },
    1000 * 60
  );

  it(
    "State changed tweet",
    async () => {
      const proposalEvent = ats.proposalEvent();
      const { proposal } = proposalEvent;
      const degovLink = ats.degovLink();
      const events = ats.stateChangedEvents(degovLink);
      for (const event of events) {
        const tweet = TweetGen.generateProposalStateChangedTweet(event);
        console.log(tweet);

        const tweetInput: SendTweetInput = {
          xprofile: proposalEvent.xprofile,
          daocode: proposalEvent.daocode,
          proposalId: proposal.id,
          chainId: proposal.chainId,
          text: tweet,
          reply: {
            in_reply_to_tweet_id: proposal.id,
          },
        };

        // Write tweet to output file
        await TweetWriter.writeTweet(
          "State Changed Tweet",
          ats.formatSendTweet(tweetInput)
        );
      }
    },
    1000 * 60
  );
});

// ----
