import { FastifyInstance } from "fastify";
import {
  CalculatedVotingDistribution,
  NewProposalEvent,
  PromptOutput,
} from "../../types";
import { SimpleTweetUser } from "../x-agent";
import { getBuiltInPrompt } from "./common";
import { DegovHelpers, PollTweetDurationResult } from "../../helpers";

export class DegovPrompt {
  static async newProposalTweet(
    fastify: FastifyInstance,
    options: {
      stu: SimpleTweetUser;
      event: NewProposalEvent;
      pollTweetDurationResult: PollTweetDurationResult;
    }
  ): Promise<PromptOutput> {
    const { event, stu, pollTweetDurationResult } = options;
    const proposal = event.proposal;
    const rawData = {
      daoname: event.daoname,
      carry: event.carry,
      url: proposal.url,
      description: proposal.description,
      verified: stu.verified,
      // related: https://github.com/ringecosystem/degov-essential/issues/90
      // clean up at twitter username
      // daox: event.daox,
      transactionLink: proposal.transactionLink,
      voteEnd: pollTweetDurationResult.proposalEndTimestamp,
    };
    return {
      system: await getBuiltInPrompt(
        fastify,
        "prompts/tweet-new-proposal.system.md"
      ),
      prompt: `
${DegovHelpers.safeJsonStringify(rawData)}

Generate a poll tweet use above data
    `,
    };
  }

  static async newExpiringSoonProposalTweet(
    fastify: FastifyInstance,
    options: {
      stu: SimpleTweetUser;
      event: NewProposalEvent;
      voteEnd: Date;
      durationMinutes?: number;
    }
  ): Promise<PromptOutput> {
    const { event, stu } = options;
    const proposal = event.proposal;
    const rawData = {
      daoname: event.daoname,
      carry: event.carry,
      url: proposal.url,
      description: proposal.description,
      verified: stu.verified,
      durationMinutes: options.durationMinutes,
      voteEnd: options.voteEnd.toISOString(),
      daox: event.daox,
      transactionLink: proposal.transactionLink,
    };
    return {
      system: await getBuiltInPrompt(
        fastify,
        "prompts/tweet-new-expiring-soon-proposal.system.md"
      ),
      prompt: `
${DegovHelpers.safeJsonStringify(rawData)}

Generate a tweet use above data
    `,
    };
  }

  static async newVoteCastTweet(
    fastify: FastifyInstance,
    options: NewVoteCastTweetOptioins
  ): Promise<PromptOutput> {
    const rawData = {
      ensName: options.ensName,
      voterAddress: options.voterAddress,
      voterXUsername: options.voterXUsername,
      voterAddressLink: options.voterAddressLink,
      transactionLink: options.transactionLink,
      proposalLink: options.proposalLink,
      choice: options.choice,
      reason: options.reason,
      verified: options.stu.verified,
      votingDistribution: options.votingDistribution,
    };
    return {
      system: await getBuiltInPrompt(
        fastify,
        "prompts/tweet-new-vote-cast.system.md"
      ),
      prompt: `
${DegovHelpers.safeJsonStringify(rawData)}

Generate a tweet use above data
      `,
    };
  }

  static async fulfillContract(
    fastify: FastifyInstance,
    options: FulfillContractOptions
  ): Promise<PromptOutput> {
    return {
      system: await getBuiltInPrompt(
        fastify,
        "prompts/tweet-fulfill-contract.system.md"
      ),
      prompt: `
**X Poll:**
${DegovHelpers.safeJsonStringify(options.pollOptions)}

**X Comments:**
${DegovHelpers.safeJsonStringify(options.tweetReplies)}

**On-Chain Voting:**
${DegovHelpers.safeJsonStringify(options.voteCasts)}

Please analyze these data comprehensively and give final governance decision recommendations.
      `,
    };
  }

  static async proposalSummary(
    fastify: FastifyInstance,
    options: ProposalSummaryOptions
  ): Promise<PromptOutput> {
    return {
      system: await getBuiltInPrompt(
        fastify,
        "prompts/proposal-summary.system.md"
      ),
      prompt: `
${options.description}

----
Generate a comprehensive summary of the proposal based on the description provided.
      `,
    };
  }
}

export interface ProposalSummaryOptions {
  description: string;
}

export interface FulfillContractOptions {
  pollOptions: {
    label: string;
    votes: number;
    position: number;
  }[];
  tweetReplies: {
    text: string | undefined;
    like_count: number;
    retweet_count: number;
    reply_count: number;
    ctime: Date;
  }[];
  voteCasts: {
    support: string;
    reason: string;
    voter?: string;
    weight: string;
    blockTimestamp: Date;
  }[];
}

export interface NewVoteCastTweetOptioins {
  stu: SimpleTweetUser;
  ensName?: string;
  voterXUsername?: string;
  voterAddress: string;
  voterAddressLink: string;
  proposalLink: string;
  transactionLink?: string;
  choice: string;
  reason: string;
  votingDistribution?: CalculatedVotingDistribution;
}
