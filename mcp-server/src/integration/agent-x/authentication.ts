import { Scraper } from "agent-twitter-client";
import {
  AuthConfig,
  CookieAuth,
  CredentialsAuth,
  ApiAuth,
  TwitterAgentError,
  AuthMethod,
  XApiVersion,
} from "./types";

export type ScraperKeyOptions =
  | { apiVersion?: XApiVersion; alias: string }
  | {
      apiVersion?: XApiVersion;
      method: AuthMethod;
      data?: CookieAuth | CredentialsAuth | ApiAuth;
    };

export class AuthenticationManager {
  private static instance: AuthenticationManager;
  private scraperInstances = new Map<string, Scraper>();

  private constructor() {}

  public static getInstance(): AuthenticationManager {
    if (!AuthenticationManager.instance) {
      AuthenticationManager.instance = new AuthenticationManager();
    }
    return AuthenticationManager.instance;
  }

  public async getScraper(
    options: ScraperKeyOptions
  ): Promise<Scraper | undefined> {
    const key = this.getScraperKey(options);
    return this.scraperInstances.get(key);
  }

  /**
   * Get or create a scraper instance based on the provided authentication config
   */
  public async regist(config: AuthConfig): Promise<Scraper> {
    const key = this.getScraperKey(config);

    if (this.scraperInstances.has(key)) {
      const scraper = this.scraperInstances.get(key)!;
      try {
        const isLoggedIn = await scraper.isLoggedIn();
        if (isLoggedIn) {
          return scraper;
        }
      } catch (error) {
        console.error("Error checking login status:", error);
      }
    }

    // Create a new scraper and authenticate
    const scraper = new Scraper();
    try {
      await this.authenticate(scraper, config);
      this.scraperInstances.set(key, scraper);
      return scraper;
    } catch (error) {
      throw new TwitterAgentError(
        `Authentication failed: ${(error as Error).message}`,
        "auth_failure",
        401
      );
    }
  }

  /**
   * Authenticate a scraper instance based on config
   */
  private async authenticate(
    scraper: Scraper,
    config: AuthConfig
  ): Promise<void> {
    switch (config.method) {
      case "cookies":
        await this.authenticateWithCookies(scraper, config.data as CookieAuth);
        break;
      case "credentials":
        await this.authenticateWithCredentials(
          scraper,
          config.data as CredentialsAuth
        );
        break;
      case "api":
        await this.authenticateWithApi(scraper, config.data as ApiAuth);
        break;
      default:
        throw new TwitterAgentError(
          `Unsupported authentication method: ${config.method}`,
          "unsupported_auth_method",
          400
        );
    }
  }

  /**
   * Authenticate using cookies
   */
  private async authenticateWithCookies(
    scraper: Scraper,
    auth: CookieAuth
  ): Promise<void> {
    try {
      await scraper.setCookies(auth.cookies);
      const isLoggedIn = await scraper.isLoggedIn();
      if (!isLoggedIn) {
        throw new TwitterAgentError(
          "Cookie authentication failed",
          "cookie_auth_failure",
          401
        );
      }
    } catch (error) {
      if (error instanceof TwitterAgentError) {
        throw error;
      }
      throw new TwitterAgentError(
        `Cookie authentication error: ${(error as Error).message}`,
        "cookie_auth_error",
        500
      );
    }
  }

  /**
   * Authenticate using username/password
   */
  private async authenticateWithCredentials(
    scraper: Scraper,
    auth: CredentialsAuth
  ): Promise<void> {
    try {
      await scraper.login(
        auth.username,
        auth.password,
        auth.email,
        auth.twoFactorSecret
      );
    } catch (error) {
      throw new TwitterAgentError(
        `Credential authentication error: ${(error as Error).message}`,
        "credential_auth_error",
        401
      );
    }
  }

  /**
   * Authenticate using Twitter API keys
   */
  private async authenticateWithApi(
    scraper: Scraper,
    auth: ApiAuth
  ): Promise<void> {
    try {
      // Login with temporary credentials to get a session
      await scraper.login(
        "temp_user",
        "temp_pass",
        undefined,
        undefined,
        auth.apiKey,
        auth.apiSecretKey,
        auth.accessToken,
        auth.accessTokenSecret
      );
    } catch (error) {
      throw new TwitterAgentError(
        `API authentication error: ${(error as Error).message}`,
        "api_auth_error",
        401
      );
    }
  }

  /**
   * Generate a unique key for the scraper instance
   */
  private getScraperKey(options: ScraperKeyOptions): string {
    let version = options.apiVersion ?? "v1"; // Default to v1 if not specified
    if (!options.apiVersion && "method" in options) {
      if ("api" === options.method) {
        version = "v2"; // API method always uses v2
      }
    }

    if ("alias" in options) {
      return `${options.alias.toUpperCase()}_${version}`;
    }

    const { method, data } = options;

    switch (method) {
      case "cookies": {
        const cookieAuth = data as CookieAuth | undefined;
        if (cookieAuth && Array.isArray(cookieAuth.cookies)) {
          const authToken = cookieAuth.cookies.find((c) =>
            c.includes("auth_token=")
          );
          const ct0 = cookieAuth.cookies.find((c) => c.includes("ct0="));
          if (authToken && ct0) {
            const authTokenVal = authToken.split("=")[1].split(";")[0];
            const ct0Val = ct0.split("=")[1].split(";")[0];
            return `cookies_${authTokenVal}_${ct0Val}_${version}`;
          }
        }
        return `cookies_${Date.now()}`;
      }
      case "credentials": {
        const creds = data as CredentialsAuth | undefined;
        return creds && creds.username
          ? `credentials_${creds.username}_${version}`
          : `credentials_${Date.now()}_${version}`;
      }
      case "api": {
        const api = data as ApiAuth | undefined;
        return api && api.apiKey
          ? `api_${api.apiKey}_${version}`
          : `api_${Date.now()}_${version}`;
      }
      default:
        return `unknown_${Date.now()}`;
    }
  }

  /**
   * Clear all scraper instances
   */
  public clearAllScrapers(): void {
    this.scraperInstances.clear();
  }

  /**
   * Try to authenticate with both cookies and credentials if available
   * This is useful for Grok which may require both
   */
  public async getHybridScraper(
    cookieConfig?: AuthConfig,
    credentialsConfig?: AuthConfig
  ): Promise<Scraper> {
    // Create a new scraper
    const scraper = new Scraper();

    let isLoggedIn = false;

    // Try cookies first if available
    if (cookieConfig && cookieConfig.method === "cookies") {
      try {
        await this.authenticateWithCookies(
          scraper,
          cookieConfig.data as CookieAuth
        );
        isLoggedIn = await scraper.isLoggedIn();
      } catch (error) {
        console.warn(
          "Cookie authentication failed, will try credentials:",
          error
        );
      }
    }

    // If cookies didn't work or weren't provided, try credentials
    if (
      !isLoggedIn &&
      credentialsConfig &&
      credentialsConfig.method === "credentials"
    ) {
      try {
        await this.authenticateWithCredentials(
          scraper,
          credentialsConfig.data as CredentialsAuth
        );
        isLoggedIn = await scraper.isLoggedIn();
      } catch (error) {
        console.warn("Credential authentication failed:", error);
      }
    }

    if (!isLoggedIn) {
      throw new TwitterAgentError(
        "Failed to authenticate with both cookies and credentials",
        "hybrid_auth_failure",
        401
      );
    }

    return scraper;
  }
}
