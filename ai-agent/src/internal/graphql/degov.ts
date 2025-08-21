import { Service } from "typedi";
import { gql, request } from "graphql-request";
import {
  DIProposal,
  DIProposalCanceled,
  DIProposalExecuted,
  DIProposalQueued,
  DIVoteCast,
  QueryNextProposalOptions,
  QueryProposalById,
  QueryProposalVotes,
  VotingDistribution,
  VotingDistributionPeerSupport,
} from "./types";
import { DegovHelpers } from "../../helpers";
import { VoteSupport } from "../../types";

@Service()
export class DegovIndexer {
  async queryProposalById(
    options: QueryProposalById
  ): Promise<DIProposal | undefined> {
    const document = gql`
      query QueryProposal($proposal_id: String!) {
        proposals(where: { proposalId_eq: $proposal_id }) {
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
        proposal_id: options.proposalId,
      }
    );
    const proposals = response.proposals;
    if (proposals.length === 0) {
      return undefined; // No proposal found
    }
    return proposals[0]; // Return the first proposal
  }

  async queryNextProposals(
    options: QueryNextProposalOptions
  ): Promise<DIProposal[]> {
    const document = gql`
      query QueryProposals($last_block_number: BigInt) {
        proposals(
          orderBy: blockNumber_ASC
          limit: 10
          where: { blockNumber_gt: $last_block_number }
        ) {
          proposalId
          proposer
          blockNumber
          blockTimestamp
          voteStart
          voteEnd
          description
          transactionHash
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
    return proposals ?? [];
  }

  async queryProposalVotes(options: QueryProposalVotes): Promise<DIVoteCast[]> {
    const limit = 50;
    const document = gql`
      query QueryProposalVotes(
        $offset: Int!
        $limit: Int!
        $proposal_id: String!
      ) {
        voteCasts(
          offset: $offset
          limit: $limit
          orderBy: blockNumber_ASC
          where: { proposalId_eq: $proposal_id }
        ) {
          id
          proposalId
          reason
          support
          transactionHash
          voter
          weight
          blockNumber
          blockTimestamp
        }
      }
    `;

    const enableQueryFullData = options.enableQueryFullData ?? false;
    let offset = options.offset;
    const result = [];
    while (true) {
      const response = await request<{ voteCasts: DIVoteCast[] }>(
        options.endpoint,
        document,
        {
          offset,
          limit,
          proposal_id: options.proposalId,
        }
      );
      const voteCasts = response.voteCasts;
      if (voteCasts.length === 0) {
        break;
      }
      result.push(...voteCasts);
      if (!enableQueryFullData) {
        break;
      }
      offset += voteCasts.length;
      if (voteCasts.length < limit) {
        break; // No more votes to fetch
      }
    }
    return result;
  }

  async queryProposalCanceled(
    options: QueryProposalById
  ): Promise<DIProposalCanceled | undefined> {
    const document = gql`
      query QueryProposalCanceleds($proposal_id: String!) {
        proposalCanceleds(where: { proposalId_eq: $proposal_id }) {
          id
          proposalId
          transactionHash
          blockNumber
          blockTimestamp
        }
      }
    `;
    const response = await request<{ proposalCanceleds: DIProposalCanceled[] }>(
      options.endpoint,
      document,
      {
        proposal_id: options.proposalId,
      }
    );
    const proposalCanceleds = response.proposalCanceleds;
    if (proposalCanceleds.length === 0) {
      return undefined; // No canceled proposal found
    }
    return proposalCanceleds[0]; // Return the first canceled proposal
  }

  async queryProposalQueued(
    options: QueryProposalById
  ): Promise<DIProposalQueued | undefined> {
    const document = gql`
      query QueryProposalQueued($proposal_id: String!) {
        proposalQueueds(where: { proposalId_eq: $proposal_id }) {
          id
          proposalId
          transactionHash
          etaSeconds
          blockNumber
          blockTimestamp
        }
      }
    `;
    const response = await request<{ proposalQueueds: DIProposalQueued[] }>(
      options.endpoint,
      document,
      {
        proposal_id: options.proposalId,
      }
    );
    const proposalQueueds = response.proposalQueueds;
    if (proposalQueueds.length === 0) {
      return undefined; // No queued proposal found
    }

    return proposalQueueds[0]; // Return the first queued proposal
  }

  async queryProposalExecuted(
    options: QueryProposalById
  ): Promise<DIProposalExecuted | undefined> {
    const document = gql`
      query QueryProposalExecuted($proposal_id: String!) {
        proposalExecuteds(where: { proposalId_eq: $proposal_id }) {
          id
          proposalId
          transactionHash
          blockNumber
          blockTimestamp
        }
      }
    `;
    const response = await request<{ proposalExecuteds: DIProposalExecuted[] }>(
      options.endpoint,
      document,
      {
        proposal_id: options.proposalId,
      }
    );
    const proposalExecuteds = response.proposalExecuteds;
    if (proposalExecuteds.length === 0) {
      return undefined; // No executed proposal found
    }
    return proposalExecuteds[0]; // Return the first executed proposal
  }

  async queryVotingDistribution(
    options: QueryProposalById
  ): Promise<VotingDistribution> {
    const limit = 50;
    const document = gql`
      query QueryVotingDistribution(
        $proposal_id: String!
        $offset: Int!
        $limit: Int!
      ) {
        voteCasts(
          where: { proposalId_eq: $proposal_id }
          offset: $offset
          limit: $limit
          orderBy: blockTimestamp_ASC
        ) {
          support
          weight
        }
      }
    `;

    let offset = 0;
    const allVoteCasts: { support: string; weight: string }[] = [];

    // get all voting record
    while (true) {
      const response = await request<{
        voteCasts: { support: string; weight: string }[];
      }>(options.endpoint, document, {
        proposal_id: options.proposalId,
        offset,
        limit,
      });

      const voteCasts = response.voteCasts;
      if (voteCasts.length === 0) {
        break;
      }

      allVoteCasts.push(...voteCasts);
      offset += voteCasts.length;

      if (voteCasts.length < limit) {
        break;
      }
    }

    // calculate total weight and distribution by support
    let totalWeight = BigInt(0);
    const distributionSupport: VotingDistributionPeerSupport = {
      voteFor: 0n,
      voteAgainst: 0n,
      voteAbstain: 0n,
    };

    for (const voteCast of allVoteCasts) {
      const weight = BigInt(voteCast.weight);
      const support = voteCast.support;
      const formattedSupported = DegovHelpers.voteSupportText(support);

      totalWeight += weight;

      switch (formattedSupported) {
        case VoteSupport.Against:
          distributionSupport.voteAgainst! += weight;
          break;
        case VoteSupport.For:
          distributionSupport.voteFor! += weight;
          break;
        case VoteSupport.Abstain:
          distributionSupport.voteAbstain! += weight;
          break;
      }
    }

    return {
      totalWeight: totalWeight,
      distributionSupport: distributionSupport,
    };
  }
}
