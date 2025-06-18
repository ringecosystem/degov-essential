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

  static envRequired(key: string, options?: { defaultValue?: string }): string {
    const v = EnvReader.env(key, {
      defaultValue: options?.defaultValue,
      optional: false,
    });
    if (!v) {
      throw new Error(`Environment variable ${key} is not set`);
    }
    return v;
  }

  static envBool(key: string, options?: { defaultValue?: string }): boolean {
    const value = EnvReader.env(key, {
      defaultValue: options?.defaultValue,
      optional: true,
    });
    if (!value) {
      return false;
    }
    return value.trim().toLowerCase() === "true" || value === "1";
  }

  static envInt(key: string, options?: { defaultValue?: string }): number {
    const value = EnvReader.envRequired(key, {
      defaultValue: options?.defaultValue,
    });
    return parseInt(value!, 10);
  }

  static aiModel(): string {
    return EnvReader.envRequired("OPENROUTER_DEFAULT_MODEL", {
      defaultValue: "google/gemini-2.5-flash-preview",
    })!;
  }

  static twitterEnv(): TwittterEnv {
    return {
      apiKey: EnvReader.envRequired("X_API_KEY"),
      apiSecretKey: EnvReader.envRequired("X_API_SECRET_KEY"),
      callbackHost: EnvReader.envRequired("X_CALLBACK_HOST"),
    };
  }
}

export interface TwittterEnv {
  apiKey: string;
  apiSecretKey: string;
  callbackHost: string;
}
