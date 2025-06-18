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
    return EnvReader.env(key, {
      defaultValue: options?.defaultValue,
      optional: false,
    })!;
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
    return EnvReader.env("OPENROUTER_DEFAULT_MODEL", {
      defaultValue: "google/gemini-2.5-flash-preview",
    })!;
  }
}
