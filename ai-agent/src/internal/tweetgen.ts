import { DegovLink } from "../helpers";
import { ProposalState } from "../types";
// import * as changeCase from "change-case";
import { Case } from "change-case-all";

export interface GenProposalStateChangedTweetInput {
  degovLink: DegovLink;
  proposalId: string;
  state: ProposalState;
  transactionHash?: string;
  eta?: Date;
}

export class TweetGen {
  static generateProposalStateChangedTweet(
    input: GenProposalStateChangedTweetInput
  ): string {
    const generator = new ProposalStateChangedTweetGenerator(input);
    return generator.generate();
  }
}

class ProposalStateChangedTweetGenerator {
  constructor(private readonly input: GenProposalStateChangedTweetInput) {}

  generate(): string {
    const proposalLink = this.input.degovLink.proposal(this.input.proposalId);
    const moreInfos: string[] = [];

    if (this.input.transactionHash) {
      const transactionLink = this.input.degovLink.transaction(
        this.input.transactionHash
      );
      moreInfos.push(`🔗 Transaction: ${transactionLink}`);
    }
    if (this.input.eta) {
      const formattedDate = new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "UTC",
        hour12: true,
      }).format(this.input.eta);
      moreInfos.push(`📅 ETA: ${formattedDate} UTC`);
    }

    return [
      `${this.bestStatusEmoji(
        this.input.state
      )} Proposal status update: ${Case.pascal(this.input.state)}`,
      ...moreInfos,
      `👉 See the latest: ${proposalLink}`,
    ].join("\n");
  }

  private bestStatusEmoji(status: ProposalState): string {
    switch (status) {
      case ProposalState.Pending:
        return "⏳";
      case ProposalState.Active:
        return "🗳️";
      case ProposalState.Canceled:
        return "❌";
      case ProposalState.Defeated:
        return "💔";
      case ProposalState.Succeeded:
        return "🎉";
      case ProposalState.Queued:
        return "🚶";
      case ProposalState.Expired:
        return "🍂";
      case ProposalState.Executed:
        return "🏁";
      default:
        return "❓"; // Unknown status
    }
  }
}
