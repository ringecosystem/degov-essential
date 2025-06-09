export class EnvReader {
  static env(
    key: string,
    options?: { defaultValue?: string; optional?: boolean }
  ): string | undefined {
    const value = process.env[key];
    if (value === undefined) {
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
    return value;
  }

  static twitterEnv(): TwittterEnv {
    return {
      apiKey: EnvReader.env("X_API_KEY")!,
      apiSecretKey: EnvReader.env("X_API_SECRET_KEY")!,
      callbackHost: EnvReader.env("X_CALLBACK_HOST")!,
    };
  }
}

export interface TwittterEnv {
  apiKey: string;
  apiSecretKey: string;
  callbackHost: string;
}
