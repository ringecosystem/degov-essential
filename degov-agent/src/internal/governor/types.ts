export interface BaseContractOptions {
  chainId: number;
  endpoint?: string;
  contractAddress: `0x${string}`;
}

export interface QueryStatusOptions extends BaseContractOptions {
  proposalId: string;
}
