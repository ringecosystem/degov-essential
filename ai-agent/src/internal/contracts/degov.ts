import { Service } from "typedi";
import {
  createPublicClient,
  createWalletClient,
  http,
  PrivateKeyAccount,
} from "viem";
import * as viemChain from "viem/chains";
import {
  BaseContractOptions,
  QueryStatusOptions,
  CastVoteOptions,
  BaseWriteContraceOptions,
  QueryQuorumOptions,
  QuorumResult,
} from "./types";
import { ClockMode, ProposalState } from "../../types";
import { DegovHelpers } from "../../helpers";
import { privateKeyToAccount } from "viem/accounts";
import { EnvReader } from "../../integration/env-reader";

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

const ABI_FUNCTION_CLOCK_MODE = [
  {
    inputs: [],
    name: "CLOCK_MODE",
    outputs: [{ internalType: "string", name: "", type: "string" }],
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

const ABI_FUNCTION_QUORUM = [
  {
    inputs: [{ internalType: "uint256", name: "blockNumber", type: "uint256" }],
    name: "quorum",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

const ABI_FUNCTION_CLOCK = [
  {
    inputs: [],
    name: "clock",
    outputs: [{ internalType: "uint48", name: "", type: "uint48" }],
    stateMutability: "view",
    type: "function",
  },
];

const ABI_FUNCTION_DECIMALS = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
];

@Service()
export class DegovContract {
  private private_key: PrivateKeyAccount | undefined;

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

    const account = options.account ?? this.privateAccount();

    if (chain) {
      return createWalletClient({
        chain,
        transport: options.endpoint ? http(options.endpoint) : http(),
        account: account,
      });
    }

    if (options.endpoint) {
      return createWalletClient({
        transport: http(options.endpoint),
        account: account,
      });
    }

    throw new Error(
      `Chain with id ${options.chainId} not found and no endpoint provided.`
    );
  }

  // todo: change to use kms
  private privateAccount(): PrivateKeyAccount {
    if (this.private_key) {
      return this.private_key;
    }
    const dapk = EnvReader.env("DEGOV_AGENT_PRIVATE_KEY");
    this.private_key = privateKeyToAccount(dapk as `0x${string}`);
    return this.private_key;
  }

  botAccoutAddress(): `0x${string}` {
    return this.privateAccount().address;
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

  async clockMode(options: BaseContractOptions): Promise<ClockMode> {
    const client = this.client(options);
    try {
      const result = await client.readContract({
        address: options.contractAddress,
        abi: ABI_FUNCTION_CLOCK_MODE,
        functionName: "CLOCK_MODE",
      });

      if (!result || typeof result !== "string") {
        return ClockMode.BlockNumber;
      }

      // result is mode=timestamp&some=value
      // Parse the mode parameter safely
      const params = result.split("&");
      let mode: string | undefined;

      for (const param of params) {
        const [key, value] = param.split("=");
        if (key === "mode" && value) {
          mode = value.toLowerCase();
          break;
        }
      }

      if (!mode) {
        return ClockMode.BlockNumber;
      }

      if (mode === "timestamp") {
        return ClockMode.Timestamp;
      }
      if (mode === "blocknumber") {
        return ClockMode.BlockNumber;
      }
      throw new Error(`Unknown clock mode: ${mode} in result: ${result}`);
    } catch (error: any) {
      // If the function doesn't exist on the contract, return BlockNumber as default
      const message = error.message;
      if (
        message &&
        (message.includes("not found on ABI") || message.includes("CLOCK_MODE"))
      ) {
        return ClockMode.BlockNumber;
      }
      // Re-throw other errors
      throw error;
    }
  }

  async castVoteWithReason(options: CastVoteOptions): Promise<string> {
    const wallet = this.wallet(options);
    const account = options.account ?? this.privateAccount();
    const hash = await wallet.writeContract({
      address: options.contractAddress,
      abi: ABI_FUNCTION_CAST_VOTE_WITH_REASON,
      chain: wallet.chain,
      functionName: "castVoteWithReason",
      args: [options.proposalId, options.support, options.reason],
      account: account,
    });
    return hash;
  }

  async quorum(options: QueryQuorumOptions): Promise<QuorumResult | undefined> {
    const client = this.client(options);

    let clock: bigint | undefined = undefined;
    try {
      const result = await client.readContract({
        address: options.contractAddress,
        abi: ABI_FUNCTION_CLOCK,
        functionName: "clock",
      });
      if (result) {
        clock = BigInt(result.toString());
      }
    } catch (e: any) {
      console.warn(`failed to query clock: ${e}`);
    }
    if (!clock) {
      const clockMode = await this.clockMode(options);
      const latestBlock = await client.getBlock();
      switch (clockMode) {
        case ClockMode.Timestamp:
          clock = latestBlock.timestamp - 60n * 3n;
          break;
        case ClockMode.BlockNumber:
          // Use a block number that's safely in the past to avoid "block not yet mined" error
          clock = latestBlock.number - 10n;
          break;
      }
    }

    const quorumResult = await client.readContract({
      address: options.contractAddress,
      abi: ABI_FUNCTION_QUORUM,
      functionName: "quorum",
      args: [clock],
    });
    if (!quorumResult) {
      return undefined;
    }
    const quorum = BigInt(quorumResult.toString());
    const includeDecimals = options.includeDecimals ?? false;

    let decimals: bigint | undefined = undefined;
    if (includeDecimals && options.standard && options.governorTokenAddress) {
      switch (options.standard) {
        case "ERC20": {
          const decimalsResult = await client.readContract({
            address: options.governorTokenAddress,
            abi: ABI_FUNCTION_DECIMALS,
            functionName: "decimals",
          });
          if (decimalsResult) {
            decimals = BigInt(decimalsResult.toString());
          } else {
            console.warn(
              `Failed to query decimals for governor token address ${options.governorTokenAddress}`
            );
          }
          break;
        }
        case "ERC721":
          decimals = 1n;
          break;
        default:
          throw new Error(`unsupported contract standard: ${options.standard}`);
      }
    }

    return {
      quorum,
      decimals,
    };
  }
}
