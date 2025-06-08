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
}
