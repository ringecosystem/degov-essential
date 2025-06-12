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

  static envBool(key: string, options?: { defaultValue?: string }): boolean {
    const value = this.env(key, {
      defaultValue: options?.defaultValue,
      optional: true,
    });
    if (!value) {
      return false;
    }
    return value.toLowerCase() === "true" || value === "1";
  }
}
