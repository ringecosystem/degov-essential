import { DegovHelpers, PollTweetDurationResult } from "../src/helpers";
import { ClockMode } from "../src/types";
import { AgentTestSupport } from "./support";
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
  });

  afterAll(async () => {
    await ats.close();
  });

  // it(
  //   "Expired proposal",
  //   async () => {
  //     const proposalEvent = ats.proposalEvent();
  //     const { proposal } = proposalEvent;

  //     const calcOptions = {
  //       proposalVoteStart: proposal.voteStart,
  //       proposalVoteEnd: proposal.voteEnd,
  //       proposalCreatedBlock: proposal.blockNumber,
  //       proposalStartTimestamp: proposal.blockTimestamp,
  //       clockMode: ClockMode.Timestamp,
  //       blockInterval: 6,
  //     };

  //     const pollTweetDurationResult =
  //       DegovHelpers.calculatePollTweetDurationMinutes(calcOptions);

  //     const fastify = ats.fastify();

  //     const promptout = await DegovPrompt.newExpiringSoonProposalTweet(
  //       fastify,
  //       {
  //         stu: ats.verifiedXUser(),
  //         event: proposalEvent,
  //         voteEnd: pollTweetDurationResult.proposalEndTimestamp,
  //         durationMinutes: pollTweetDurationResult.durationMinutes,
  //       }
  //     );

  //     const aiResp = await generateText({
  //       model: ats.openrouterAgent.openrouter(EnvReader.aiModel()),
  //       system: promptout.system,
  //       prompt: promptout.prompt,
  //     });
  //     const tweetInput: SendTweetInput = {
  //       xprofile: proposalEvent.xprofile,
  //       daocode: proposalEvent.daocode,
  //       proposalId: proposal.id,
  //       chainId: proposal.chainId,
  //       text: aiResp.text,
  //     };
  //     console.log(pollTweetDurationResult, tweetInput);
  //   },
  //   1000 * 60
  // );

  // it(
  //   "Expiring soon proposal",
  //   async () => {
  //     const proposalEvent = ats.proposalEvent();
  //     const { proposal } = proposalEvent;

  //     const fastify = ats.fastify();

  //     const pollTweetDurationResult: PollTweetDurationResult = {
  //       durationMinutes: 10,
  //       proposalStartTimestamp: new Date(),
  //       proposalEndTimestamp: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes later
  //     };

  //     const promptout = await DegovPrompt.newExpiringSoonProposalTweet(
  //       fastify,
  //       {
  //         stu: ats.verifiedXUser(),
  //         event: proposalEvent,
  //         voteEnd: pollTweetDurationResult.proposalEndTimestamp,
  //         durationMinutes: pollTweetDurationResult.durationMinutes,
  //       }
  //     );

  //     const aiResp = await generateText({
  //       model: ats.openrouterAgent.openrouter(EnvReader.aiModel()),
  //       system: promptout.system,
  //       prompt: promptout.prompt,
  //     });
  //     const tweetInput: SendTweetInput = {
  //       xprofile: proposalEvent.xprofile,
  //       daocode: proposalEvent.daocode,
  //       proposalId: proposal.id,
  //       chainId: proposal.chainId,
  //       text: aiResp.text,
  //     };
  //     console.log(pollTweetDurationResult, tweetInput);
  //   },
  //   1000 * 60
  // );

  // it(
  //   "New proposal",
  //   async () => {
  //     const proposalEvent = ats.proposalEvent();
  //     const { proposal } = proposalEvent;

  //     const fastify = ats.fastify();

  //     const promptout = await DegovPrompt.newProposalTweet(fastify, {
  //       stu: ats.verifiedXUser(),
  //       event: proposalEvent,
  //     });

  //     const aiResp = await generateText({
  //       model: ats.openrouterAgent.openrouter(EnvReader.aiModel()),
  //       system: promptout.system,
  //       prompt: promptout.prompt,
  //     });
  //     const tweetInput: SendTweetInput = {
  //       xprofile: proposalEvent.xprofile,
  //       daocode: proposalEvent.daocode,
  //       proposalId: proposal.id,
  //       chainId: proposal.chainId,
  //       text: aiResp.text,
  //     };
  //     console.log(tweetInput);
  //   },
  //   1000 * 60
  // );

  // it(
  //   "New vote cast tweet",
  //   async () => {
  //     const proposalEvent = ats.proposalEvent();
  //     const { proposal } = proposalEvent;
  //     const votes = ats.voteEvents();
  //     const degovLink = ats.degovLink();

  //     for (const vote of votes) {
  //       const promptInput = {
  //         stu: ats.verifiedXUser(),
  //         voterAddressLink: degovLink.delegate(vote.voter),
  //         proposalLink: degovLink.proposal(vote.proposalId),
  //         transactionLink: degovLink.transaction(vote.transactionHash),
  //         choice: DegovHelpers.voteSupportText(vote.support),
  //         reason: vote.reason ?? "",
  //       };
  //       const promptout = await DegovPrompt.newVoteCastTweet(
  //         ats.fastify(),
  //         promptInput
  //       );

  //       const aiResp = await generateText({
  //         model: ats.openrouterAgent.openrouter(EnvReader.aiModel()),
  //         system: promptout.system,
  //         prompt: promptout.prompt,
  //       });

  //       const tweetInput: SendTweetInput = {
  //         xprofile: proposalEvent.xprofile,
  //         daocode: proposalEvent.daocode,
  //         proposalId: proposal.id,
  //         chainId: proposal.chainId,
  //         text: aiResp.text,
  //         reply: {
  //           in_reply_to_tweet_id: proposal.id,
  //         },
  //       };
  //       console.log(tweetInput);
  //     }
  //   },
  //   1000 * 60
  // );

  it(
    "State changed tweet",
    async () => {
      const degovLink = ats.degovLink();
      const events = ats.stateChangedEvents(degovLink);
      for (const event of events) {
        const tweet = TweetGen.generateProposalStateChangedTweet(event);
        console.log(tweet);
      }
    },
    1000 * 60
  );
});

// ----
