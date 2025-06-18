import { InlineErrorV2 } from "twitter-api-v2";
import { ProposalState, RuntimeProfile } from "./types";

export class DegovHelpers {
  static runtimeProfile(): RuntimeProfile {
    const env =
      process.env.DEGOV_PROFILE || process.env.NODE_ENV || "development";
    switch (env.toLowerCase()) {
      case "production":
        return RuntimeProfile.Production;
      default:
        return RuntimeProfile.Development;
    }
  }

  static safeJsonStringify(payload: any): string {
    return JSON.stringify(payload, (_, v) => {
      if (typeof v === "bigint") {
        return v.toString();
      }
      if (v === null) {
        return undefined;
      }
      return v;
    });
  }

  static voteSupportText(support: any): string {
    const supportNumber =
      typeof support === "number" ? support : parseInt(support, 10);
    switch (supportNumber) {
      case 0:
        return "Against";
      case 1:
        return "For";
      case 2:
        return "Abstain";
      default:
        return "Unknown";
    }
  }

  static voteSupportNumber(support: string): number {
    switch (support.toLowerCase()) {
      case "against":
        return 0;
      case "for":
        return 1;
      case "abstain":
        return 2;
      default:
        throw new Error(`Unknown support type: ${support}`);
    }
  }

  static explorerLink(input?: string[]): ExplorerLink {
    if (!input || input.length === 0) {
      return new ExplorerLink(undefined);
    }
    return new ExplorerLink(input?.[0]);
  }

  static pollOptionCode(options: {
    id: string;
    label: string;
    position: number;
  }): string {
    if (
      !options ||
      !options.id ||
      !options.label ||
      options.position === undefined
    ) {
      throw new Error(
        "Invalid options provided for poll option code generation."
      );
    }
    return `${options.id}-${options.label}-${options.position}`.toLowerCase();
  }

  static helpfulErrorMessage(
    error: any,
    options?: { printTrace?: boolean }
  ): string {
    const printTrace = options?.printTrace ?? false;
    if (printTrace) {
      console.log("-->", error);
    }
    let output = error instanceof Error ? error.message : "Unknown error";
    if ("data" in error) {
      const data = error.data;
      const status = data.status;
      if (status === 429) {
        const rateLimit = error.rateLimit;
        output += ` -> You just hit the rate limit! [limit]: ${
          rateLimit?.limit
        }, [remaining]: ${rateLimit?.remaining}, [reset]: ${new Date(
          rateLimit?.reset * 1000
        ).toISOString()}`;
      }
      if (status) {
        output = `[${status}]: ${output} => ${JSON.stringify(data)}`;
      }
    }
    if ("rateLimit" in error) {
      const rateLimit = error.rateLimit;
      if (rateLimit) {
        output += ` -> Rate limit: [limit]: ${rateLimit.limit}, [remaining]: ${
          rateLimit.remaining
        }, [reset]: ${new Date(rateLimit.reset * 1000).toISOString()}`;
      }
    }
    if ("errors" in error && error.errors) {
      output = `${output}\nErrors: ${JSON.stringify(error.errors)}`;
    }
    return output;
  }

  static stdTwitterError(
    errors: InlineErrorV2[] | undefined
  ): string | undefined {
    if (!errors || errors.length === 0) {
      return;
    }
    return errors
      .map(
        (error) =>
          `[${error.type}]: ${error.title} - ${error.detail} ${error.reason}`
      )
      .join("\n");
  }

  static stdHex(input: string): `0x${string}` {
    if (!input.startsWith("0x")) {
      return `0x${input}`;
    }
    return input as `0x${string}`;
  }

  static convertToProposalStatus(status: number | string): ProposalState {
    if (typeof status === "number") {
      status = status.toString();
    }
    status = status.toLowerCase();
    switch (status) {
      case "0":
      case "pending":
        return ProposalState.Pending;
      case "1":
      case "active":
        return ProposalState.Active;
      case "2":
      case "canceled":
        return ProposalState.Canceled;
      case "3":
      case "defeated":
        return ProposalState.Defeated;
      case "4":
      case "succeeded":
        return ProposalState.Succeeded;
      case "5":
      case "queued":
        return ProposalState.Queued;
      case "6":
      case "expired":
        return ProposalState.Expired;
      case "7":
      case "executed":
        return ProposalState.Executed;
      default:
        throw new Error(`Unknown proposal status: ${status}`);
    }
  }

  static calculatePollTweetDurationMinutes(options: {
    proposalVoteEnd: Date;
  }): number | undefined {
    const now = new Date();
    const maxMinutes = 7 * 24 * 60; // 7 days in minutes
    const oneDayMinutes = 24 * 60; // 1 day in minutes
    const { proposalVoteEnd } = options;

    // expired proposal
    if (proposalVoteEnd < now) {
      const expiredMillSeconds = now.getTime() - proposalVoteEnd.getTime();
      const expiredMinutes = Math.ceil(expiredMillSeconds / 60000);
      return -expiredMinutes; // Return negative number to indicate expired time
    }

    const remainMillSeconds = proposalVoteEnd.getTime() - now.getTime();
    const remainingTimeMinutes = Math.ceil(remainMillSeconds / 60000); // Convert milliseconds to minutes

    // 1. if less then 10 minutes, return undefined
    //    This is to avoid creating a poll tweet for proposals that are about to expire.
    if (remainingTimeMinutes < 10) {
      return undefined;
    }

    // 2. if remaining time is between 10 and maxMinutes, use optimized strategy
    if (remainingTimeMinutes >= 10 && remainingTimeMinutes <= maxMinutes) {
      const threeDaysMinutes = 3 * 24 * 60; // 3 days in minutes
      const fiveDaysMinutes = 5 * 24 * 60; // 5 days in minutes
      const sixHoursMinutes = 6 * 60; // 6 hours in minutes
      const eighteenHoursMinutes = 18 * 60; // 18 hours in minutes

      // if remaining time is between 5 and 7 days,
      if (
        remainingTimeMinutes >= fiveDaysMinutes &&
        remainingTimeMinutes <= maxMinutes
      ) {
        const pollDuration = remainingTimeMinutes - oneDayMinutes;
        // ensure the poll duration is at least 10 minutes
        return Math.max(pollDuration, 10);
      }

      // if remaining time is between 3 and 5 days, use 18 hours buffer
      if (
        remainingTimeMinutes >= threeDaysMinutes &&
        remainingTimeMinutes < fiveDaysMinutes
      ) {
        const pollDuration = remainingTimeMinutes - eighteenHoursMinutes;
        // ensure the poll duration is at least 10 minutes
        return Math.max(pollDuration, 10);
      }

      // if remaining time is between 10 minutes and 3 days, use 6 hours buffer
      const pollDuration = remainingTimeMinutes - sixHoursMinutes;
      // ensure the poll duration is at least 10 minutes
      return Math.max(pollDuration, 10);
    }

    // 3. If remaining time is greater than maxMinutes but less than maxMinutes + 1 day,
    //    return the actual vote end time minus 1 day
    if (
      remainingTimeMinutes > maxMinutes &&
      remainingTimeMinutes < maxMinutes + oneDayMinutes
    ) {
      const pollDuration = remainingTimeMinutes - oneDayMinutes; // vote end time - 1 day
      return Math.max(pollDuration, 10); // ensure at least 10 minutes
    }

    // 4. If remaining time is greater than maxMinutes + 1 day,
    //   This is to ensure that the poll tweet is created with enough time for voting.
    if (remainingTimeMinutes >= maxMinutes + oneDayMinutes) {
      return maxMinutes;
    }

    return undefined;
  }
}

export class ExplorerLink {
  constructor(private readonly baseLink?: string) {}

  transaction(txhash?: string): string | undefined {
    if (!this.baseLink || !txhash) {
      return undefined;
    }
    return `${this.baseLink}/tx/${txhash}`;
  }
}
