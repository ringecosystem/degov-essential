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

  static envTwitter(): EnvReaderTwitter {
    return new EnvReaderTwitter();
  }
}

export class EnvReaderTwitter {
  constructor() {}

  profiles(): string[] {
    // return EnvReader.env("X_PROFILES", "default");
    const rawProfiles = EnvReader.env("X_PROFILES", {
      defaultValue: "default",
    });
    if (!rawProfiles) {
      return [];
    }
    return rawProfiles.trim().toUpperCase().split(",");
  }

  activeProfile(): string {
    return EnvReader.env("X_ACTIVE_PROFILE", { defaultValue: "default" })!
      .trim()
      .toUpperCase();
  }

  callbackHost(): string {
    return EnvReader.env("X_CALLBACK_HOST")!.trim();
  }

  apiKeyPair(profile: string): TwitterApiKeyPair {
    const stdProfile = profile.trim().toUpperCase();
    const apiKey = EnvReader.env(`X_${stdProfile}_API_KEY`);
    const apiSecretKey = EnvReader.env(`X_${stdProfile}_API_SECRET_KEY`);

    if (!apiKey || !apiSecretKey) {
      throw new Error(
        `API key pair not found for profile "${stdProfile}". Please set X_${stdProfile}_API_KEY and X_${stdProfile}_API_SECRET_KEY environment variables.`
      );
    }

    return {
      apiKey,
      apiSecretKey,
    };
  }
}

export interface TwitterApiKeyPair {
  apiKey: string;
  apiSecretKey: string;
}
