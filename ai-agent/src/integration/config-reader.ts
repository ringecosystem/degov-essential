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


  // static degovDaos(): DegovDaoConfig[] {
  //   return (
  //     ConfigReader.read<DegovDaoConfig[]>("daos", {
  //       defaultValue: [],
  //       optional: true,
  //     }) ?? []
  //   );
  // }
}
