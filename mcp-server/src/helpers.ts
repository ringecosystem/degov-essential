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
