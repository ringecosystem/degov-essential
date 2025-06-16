import { Address, Account } from "viem";

export interface BaseContractOptions {
  chainId: number;
  endpoint?: string;
  contractAddress: `0x${string}`;
}

export interface BaseWriteContraceOptions extends BaseContractOptions {
  account?: Account | Address;
  gas?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: bigint;
  value?: bigint;
}

export interface QueryStatusOptions extends BaseContractOptions {
  proposalId: string;
}

export interface CastVoteOptions extends BaseWriteContraceOptions {
  proposalId: bigint;
  support: number; // 0 = Against, 1 = For, 2 = Abstain
  reason: string;
}
