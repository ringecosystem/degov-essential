export interface NewProposalEvent {
  xprofile: string;
  daocode: string;
  daoname: string;
  proposal: SimpleProposal;
}

export interface SimpleProposal {
  id: string;
  chainId: number;
  url: string;
  voteStart: number;
  voteEnd: number;
  description: string;
}
