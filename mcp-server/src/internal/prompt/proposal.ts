import { FastifyInstance } from "fastify";
import { PromptOutput } from "../../tasks/types";
import { NewProposalEvent } from "../../types";
import { SimpleTweetUser } from "../x-agent";
import { getBuiltInPrompt } from "./common";

export class PromptProposal {
  static async newProposalTweet(
    fastify: FastifyInstance,
    options: {
      event: NewProposalEvent;
      stu: SimpleTweetUser;
    }
  ): Promise<PromptOutput> {
    const { event, stu } = options;
    const proposal = event.proposal;
    const rawProposal = {
      daoname: event.daoname,
      url: proposal.url,
      description: proposal.description,
      verified: stu.verified,
    };
    return {
      system: await getBuiltInPrompt(fastify, "prompts/tweet-new-proposal.system.md"),
      prompt: `
${JSON.stringify(rawProposal)}

Generate a poll tweet use above data
    `,
    };
  }
}
