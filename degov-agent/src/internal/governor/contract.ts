import { Service } from "typedi";
import { createPublicClient, createWalletClient, http, Address } from "viem";
import * as viemChain from "viem/chains";
import {
  BaseContractOptions,
  QueryStatusOptions,
  CastVoteOptions,
  BaseWriteContraceOptions,
} from "./types";
import { ProposalState } from "../../types";
import { DegovHelpers } from "../../helpers";

const ABI_FUNCTION_STATE = [
  {
    inputs: [{ internalType: "uint256", name: "proposalId", type: "uint256" }],
    name: "state",
    outputs: [
      {
        internalType: "enum IGovernor.ProposalState",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

const ABI_FUNCTION_CAST_VOTE_WITH_REASON = [
  {
    inputs: [
      { internalType: "uint256", name: "proposalId", type: "uint256" },
      { internalType: "uint8", name: "support", type: "uint8" },
      { internalType: "string", name: "reason", type: "string" },
    ],
    name: "castVoteWithReason",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

@Service()
export class GovernorContract {
  private client(options: BaseContractOptions) {
    const chain = Object.values(viemChain).find(
      (chain) => chain.id === options.chainId
    );

    if (chain) {
      return createPublicClient({
        chain,
        transport: options.endpoint ? http(options.endpoint) : http(),
      });
    }

    if (options.endpoint) {
      return createPublicClient({
        transport: http(options.endpoint),
      });
    }

    throw new Error(
      `Chain with id ${options.chainId} not found and no endpoint provided.`
    );
  }

  private wallet(options: BaseWriteContraceOptions) {
    const chain = Object.values(viemChain).find(
      (chain) => chain.id === options.chainId
    );

    if (chain) {
      return createWalletClient({
        chain,
        transport: options.endpoint ? http(options.endpoint) : http(),
        account: options.account,
      });
    }

    if (options.endpoint) {
      return createWalletClient({
        transport: http(options.endpoint),
        account: options.account,
      });
    }

    throw new Error(
      `Chain with id ${options.chainId} not found and no endpoint provided.`
    );
  }

  async status(options: QueryStatusOptions): Promise<ProposalState> {
    const client = this.client(options);
    const result = await client.readContract({
      address: options.contractAddress,
      abi: ABI_FUNCTION_STATE,
      functionName: "state",
      args: [options.proposalId],
    });

    return DegovHelpers.convertToProposalStatus(
      (result as number | bigint).toString()
    );
  }

  async castVoteWithReason(options: CastVoteOptions): Promise<string> {
    const wallet = this.wallet(options);
    const hash = await wallet.writeContract({
      address: options.contractAddress,
      abi: ABI_FUNCTION_CAST_VOTE_WITH_REASON,
      chain: wallet.chain,
      functionName: "castVoteWithReason",
      args: [options.proposalId, options.support, options.reason],
    });

    return hash;
  }
}
