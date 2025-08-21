import { DegovHelpers, PollTweetDurationResult } from "../src/helpers";
import { AnalysisResultSchema, ClockMode } from "../src/types";
import { AgentTestSupport, PreviewWriter } from "./support";
import { DegovPrompt } from "../src/internal/prompt";
import Container from "typedi";
import { generateText, generateObject } from "ai";
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
    await PreviewWriter.clearOutputFile();
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
      await PreviewWriter.write(
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
      await PreviewWriter.write(
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

      const pollTweetDurationResult: PollTweetDurationResult = {
        durationMinutes: 10,
        proposalStartTimestamp: new Date(),
        proposalEndTimestamp: new Date(Date.now() + 1000 * 60 * 1000), // 1000 minutes later
      };

      const promptout = await DegovPrompt.newProposalTweet(fastify, {
        stu: ats.verifiedXUser(),
        event: proposalEvent,
        pollTweetDurationResult,
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
      await PreviewWriter.write(
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

      let seq = 0;
      for (const vote of votes) {
        seq += 1;
        const quorumResult = ats.quorum(seq);
        const votingDistribution = ats.votingDistribution(seq);
        const calculatedVotingDistribution =
          DegovHelpers.calculateVoteDistribution({
            quorum: quorumResult,
            votingDistribution,
          });

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
          votingDistribution: calculatedVotingDistribution,
        };
        console.log(promptInput);
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
        await PreviewWriter.write(
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
        await PreviewWriter.write(
          "State Changed Tweet",
          ats.formatSendTweet(tweetInput)
        );
      }
    },
    1000 * 60
  );

  it(
    "Fulfill contract analysis",
    async () => {
      // const proposalEvent = ats.proposalEvent();
      // const { proposal } = proposalEvent;

      // Randomly choose between different scenarios
      const scenarios = ["aligned", "conflicted", "whale-dominated", "abstain-heavy"] as const;
      const randomScenario =
        scenarios[Math.floor(Math.random() * scenarios.length)];
      const randomSeed = Date.now();

      console.log(
        `=== Selected Scenario: ${randomScenario} (seed: ${randomSeed}) ===`
      );

      // Use dynamic fulfill options with random scenario
      const fulfillOptions = ats.fulfillContractOptions(
        randomScenario,
        randomSeed
      );

      const fastify = ats.fastify();

      const promptout = await DegovPrompt.fulfillContract(
        fastify,
        fulfillOptions
      );

      const aiResp = await generateObject({
        model: ats.openrouterAgent.openrouter(EnvReader.aiModel()),
        schema: AnalysisResultSchema,
        system: promptout.system,
        prompt: promptout.prompt,
      });

      console.log(`=== Fulfill Contract Analysis (${randomScenario}) ===`);
      console.log("System Prompt Length:", promptout.system?.length ?? 0);
      console.log("User Prompt Length:", promptout.prompt?.length ?? 0);
      console.log("\n=== AI Analysis Result ===");
      console.log(aiResp.object);

      // Parse and validate JSON response
      try {
        const analysisResult = aiResp.object;
        console.log("\n=== Parsed Analysis Result ===");
        console.log("Final Result:", analysisResult.finalResult);
        console.log("Confidence:", analysisResult.confidence);
        console.log("Reasoning Lite:", analysisResult.reasoningLite);
        console.log(
          "Voting Breakdown:",
          JSON.stringify(analysisResult.votingBreakdown, null, 2)
        );

        // Define expected outcomes for each scenario
        const expectedOutcomes = {
          "whale-dominated":
            "Should identify whale concentration issues and potentially lower confidence",
          conflicted:
            "May trigger Abstain rule due to conflicts between social and on-chain sentiment",
        };

        // Write analysis to output file
        await PreviewWriter.write(
          `Fulfill Contract Analysis (${randomScenario})`,
          `## 📊 Governance Analysis Result - ${randomScenario.toUpperCase()} Scenario\n\n` +
            `**Test Seed**: ${randomSeed}\n` +
            `**Final Decision**: ${analysisResult.finalResult}\n` +
            `**Confidence Score**: ${analysisResult.confidence}/10\n\n` +
            `**Quick Summary**: ${analysisResult.reasoningLite}\n\n` +
            `### Expected Outcome\n${expectedOutcomes[randomScenario]}\n\n` +
            `### Voting Breakdown\n` +
            `**X Poll**: For ${analysisResult.votingBreakdown.twitterPoll.for}%, Against ${analysisResult.votingBreakdown.twitterPoll.against}%, Abstain ${analysisResult.votingBreakdown.twitterPoll.abstain}%\n` +
            `**Comments**: Positive ${analysisResult.votingBreakdown.twitterComments.positive}%, Negative ${analysisResult.votingBreakdown.twitterComments.negative}%, Neutral ${analysisResult.votingBreakdown.twitterComments.neutral}%\n` +
            `**On-Chain**: For ${analysisResult.votingBreakdown.onChainVotes.for}%, Against ${analysisResult.votingBreakdown.onChainVotes.against}%, Abstain ${analysisResult.votingBreakdown.onChainVotes.abstain}%\n\n` +
            `### Mock Data Summary\n` +
            `**X Poll Total Votes**: ${fulfillOptions.pollOptions.reduce(
              (sum, opt) => sum + opt.votes,
              0
            )}\n` +
            `**Comments Count**: ${fulfillOptions.tweetReplies.length}\n` +
            `**On-Chain Votes**: ${fulfillOptions.voteCasts.length}\n\n` +
            `### Full Analysis Report\n${analysisResult.reasoning}\n\n` +
            `---\n\n` +
            `**Raw AI Response**:\n\`\`\`json\n${JSON.stringify(
              aiResp.object,
              null,
              2
            )}\n\`\`\``
        );
      } catch (error) {
        console.error("Failed to parse AI response as JSON:", error);
        console.error("Raw response:", aiResp.object);

        // Write error analysis to output file
        await PreviewWriter.write(
          `Fulfill Contract Analysis (${randomScenario} - ERROR)`,
          `## ❌ Analysis Failed - Invalid JSON Response\n\n` +
            `**Scenario**: ${randomScenario}\n` +
            `**Test Seed**: ${randomSeed}\n` +
            `**Error**: ${error}\n\n` +
            `**Raw AI Response**:\n\`\`\`\n${JSON.stringify(
              aiResp.object,
              null,
              2
            )}\n\`\`\``
        );
      }
    },
    1000 * 120 // 2 minutes timeout for complex analysis
  );
});

// ----
