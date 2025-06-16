import { DegovConfig } from "./degov-config";

export class Resp<T> {
  code: number;
  message?: string;
  data?: T;
  additional?: any;

  constructor(code: number, message?: string, data?: T, additional?: any) {
    this.code = code;
    this.message = message;
    this.data = data;
    this.additional = additional;
  }

  static create<J>(code: number, message: string, data: J): Resp<J> {
    return new Resp(code, message, data, undefined);
  }

  static ok<J>(data: J, additional?: any): Resp<J> {
    return new Resp(0, undefined, data, additional);
  }

  static err(message: string): Resp<undefined> {
    return new Resp(1, message, undefined, undefined);
  }

  static errWithData<J>(message: string, data: J): Resp<J> {
    return new Resp(1, message, data, undefined);
  }
}

export enum RuntimeProfile {
  Development = "development",
  Production = "production",
}

export interface DegovDaoConfig {
  name: string;
  code: string;
  xprofile: string;
  links: DegovMcpDaoUrl;
}

export interface DegovMcpDaoUrl {
  website: string;
  config: string;
  indexer: string;
}

export interface DegovMcpDao extends DegovDaoConfig {
  config?: DegovConfig;
  lastProcessedBlock?: number; // The last processed block by the indexer
}

export interface NewProposalEvent {
  xprofile: string;
  daocode: string;
  daoname: string;
  proposal: SimpleProposal;
  blockNumber: number;
  blockTimestamp: number;
}

export interface SimpleProposal {
  id: string;
  chainId: number;
  url: string;
  voteStart: number;
  voteEnd: number;
  description: string;
}

export interface TwitterAuthorizeForm {
  profile: string;
  method: "api";
}

export interface DegovSummaryForm {
  indexer: string;
  id: string;
}

export interface TwitterOAuthType {
  oauth_token: string;
  oauth_token_secret: string;
}

export interface QueryTwitterCallback {
  profile: string;
  oauth_token: string;
  oauth_verifier: string;
}

export interface AddVoteProgressForm {
  daocode: string;
  proposal_id: string;
  chain_id: number;
  offset: number;
}

export interface UpdateVoteProgressForm {
  proposal_id: string;
  offset: number;
}

export interface PromptOutput {
  system?: string;
  prompt: string;
}

export enum ProposalState {
  Pending = 'pending',
  Active = 'active',
  Canceled = 'canceled',
  Defeated = 'defeated',
  Succeeded = 'succeeded',
  Queued = 'queued',
  Expired = 'expired',
  Executed = 'executed',
}
