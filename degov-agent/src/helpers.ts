import { InlineErrorV2 } from "twitter-api-v2";
import { RuntimeProfile } from "./types";

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
        output = `[${status}]: ${output}`;
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
