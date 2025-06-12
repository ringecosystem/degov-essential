

export interface BaseGraphqlQuery {
  endpoint: string;
}

export interface QueryNextProposalOptions extends BaseGraphqlQuery {
  lastBlockNumber: number;
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

