export interface NewProposalEvent {
  xprofile: string;
  daoname: string;
  proposal: SimpleProposal;
}

export interface SimpleProposal {
  id: string;
  url: string;
  voteStart: number;
  voteEnd: number;
  description: string;
}
