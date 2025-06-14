import { FastifyInstance } from "fastify";
import { NewProposalEvent, PromptOutput } from "../../types";
import { SimpleTweetUser } from "../x-agent";
import { getBuiltInPrompt } from "./common";

export class PromptProposal {
  static async newProposalTweet(
    fastify: FastifyInstance,
    options: {
      stu: SimpleTweetUser;
      event: NewProposalEvent;
    }
  ): Promise<PromptOutput> {
    const { event, stu } = options;
    const proposal = event.proposal;
    const rawData = {
      daoname: event.daoname,
      url: proposal.url,
      description: proposal.description,
      verified: stu.verified,
    };
    return {
      system: await getBuiltInPrompt(
        fastify,
        "prompts/tweet-new-proposal.system.md"
      ),
      prompt: `
${JSON.stringify(rawData)}

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
      url: proposal.url,
      description: proposal.description,
      verified: stu.verified,
      durationMinutes: options.durationMinutes,
      voteEnd: options.voteEnd.toISOString(),
    };
    return {
      system: await getBuiltInPrompt(
        fastify,
        "prompts/tweet-new-expiring-soon-proposal.system.md"
      ),
      prompt: `
${JSON.stringify(rawData)}

Generate a tweet use above data
    `,
    };
  }

  static async newVoteCastTweet(
    fastify: FastifyInstance,
    options: NewVoteCastTweetOptioins
  ): Promise<PromptOutput> {
    const rawData = {
      voterAddressLink: options.voterAddressLink,
      transactionLink: options.transactionLink,
      proposalLink: options.proposalLink,
      choice: options.choice,
      reason: options.reason,
      verified: options.stu.verified,
    };
    return {
      system: await getBuiltInPrompt(
        fastify,
        "prompts/tweet-new-vote-cast.system.md"
      ),
      prompt: `
${JSON.stringify(rawData)}

Generate a tweet use above data
      `,
    };
  }
}

export interface NewVoteCastTweetOptioins {
  stu: SimpleTweetUser;
  voterAddressLink: string;
  proposalLink: string;
  transactionLink?: string;
  choice: string;
  reason: string;
}
