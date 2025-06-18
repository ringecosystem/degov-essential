export interface BaseGraphqlQuery {
  endpoint: string;
}

export interface QueryNextProposalOptions extends BaseGraphqlQuery {
  lastBlockNumber: number;
}

export interface QueryProposalVotes extends BaseGraphqlQuery {
  proposalId: string;
  offset: number;
  enableQueryFullData?: boolean;
}

export interface QueryProposalById extends BaseGraphqlQuery {
  proposalId: string;
}

export interface DIProposal {
  proposalId: string;
  proposer: string;
  blockNumber: string;
  blockTimestamp: string;
  voteStart: string;
  voteEnd: string;
  description: string;
}

export interface DIVoteCast {
  id: string;
  proposalId: string;
  reason: string;
  support: string;
  transactionHash: string;
  voter: string;
  weight: string;
  blockNumber: string;
  blockTimestamp: string;
}

export interface DIProposalCanceled {
  id: string;
  proposalId: string;
  transactionHash: string;
  blockNumber: string;
  blockTimestamp: string;
}

export interface DIProposalQueued {
  id: string;
  proposalId: string;
  transactionHash: string;
  etaSeconds: string;
  blockNumber: string;
  blockTimestamp: string;
}

export interface DIProposalExecuted {
  id: string;
  proposalId: string;
  transactionHash: string;
  blockNumber: string;
  blockTimestamp: string;
}
