import config from "config";
import { DegovDaoConfig } from "../types";

export class ConfigReader {
  static read<T>(
    key: string,
    options?: { defaultValue?: T; optional?: boolean }
  ): T | undefined {
    const result = config.get(key);
    if (result) {
      return result as T;
    }

    const defaultValue = options?.defaultValue;
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    const optional = options?.optional;
    if (optional) {
      return undefined;
    }
    throw new Error(`Environment variable ${key} is not set`);
  }

  static twitterEnv(): TwittterEnv {
    return {
      apiKey: ConfigReader.read("twitter.api_key")!,
      apiSecretKey: ConfigReader.read("twitter.secret_key")!,
      callbackHost: ConfigReader.read("twitter.callback_host")!,
    };
  }

  static degovDaos(): DegovDaoConfig[] {
    return (
      ConfigReader.read<DegovDaoConfig[]>("daos", {
        defaultValue: [],
        optional: true,
      }) ?? []
    );
  }
}

export interface TwittterEnv {
  apiKey: string;
  apiSecretKey: string;
  callbackHost: string;
}
