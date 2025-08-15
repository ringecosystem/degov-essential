// const

import { DegovHelpers } from "../src/helpers";
import { ClockMode } from "../src/types";
import { AgentTestSupport } from "./support";
import { DegovPrompt } from "../src/internal/prompt";
import Container from "typedi";
import { generateText } from "ai";
import { EnvReader } from "../src/integration/env-reader";
import { SendTweetInput } from "../src/internal/x-agent";

describe("X Tweet Preview Test", () => {
  const ats: AgentTestSupport = Container.get(AgentTestSupport);

  beforeAll(async () => {
    await ats.init();
  });

  afterAll(async () => {
    await ats.close();
  });

  it(
    "Preview New Proposal Tweet",
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

      const promptout = await DegovPrompt.newExpiringSoonProposalTweet(
        ats.fastify(),
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
      console.log(tweetInput);
    },
    1000 * 60
  );
});

// ----
