import { Service } from "typedi";
import { gql, request } from "graphql-request";
import { DIProposal, QueryNextProposalOptions } from "./types";

@Service()
export class DegovIndexerProposal {
  async queryNextProposal(
    options: QueryNextProposalOptions
  ): Promise<DIProposal | undefined> {
    const document = gql`
      query QueryProposals($last_block_number: BigInt) {
        proposals(
          orderBy: blockNumber_ASC
          limit: 1
          where: { blockNumber_gt: $last_block_number }
        ) {
          proposalId
          proposer
          blockNumber
          blockTimestamp
          voteStart
          voteEnd
          description
        }
      }
    `;
    const response = await request<{ proposals: DIProposal[] }>(
      options.endpoint,
      document,
      {
        last_block_number: options.lastBlockNumber,
      }
    );
    const proposals = response.proposals;
    if (proposals.length === 0) {
      return undefined; // No new proposals found
    }
    return proposals[0];
  }
}
