import { FastifyInstance } from "fastify";
import { PromptOutput } from "../../tasks/types";
import { NewProposalEvent } from "../../types";
import { SimpleTweetUser } from "../x-agent";
import { getBuiltInPrompt } from "./common";
import { DIVoteCast } from "../graphql";

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

  static async newVoteCastTweet(
    fastify: FastifyInstance,
    options: NewVoteCastTweetOptioins
  ): Promise<PromptOutput> {
    const rawData = {
      voterAddress: options.voterAddress,
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
  voterAddress: string;
  voterAddressLink: string;
  proposalLink: string;
  transactionLink?: string;
  choice: string;
  reason: string;
}
