import { Scraper } from "agent-twitter-client";
import {
  AuthConfig,
  CookieAuth,
  CredentialsAuth,
  ApiAuth,
  TwitterAgentError,
} from "./types.js";

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
  private getScraperKey(config: AuthConfig): string {
    if (config.alias) {
      return config.alias;
    }

    let cookieAuth: CookieAuth;
    let authTokenCookie: string | undefined;
    let ct0Cookie: string | undefined;
    let authToken: string;
    let ct0: string;
    let creds: CredentialsAuth;
    let api: ApiAuth;

    switch (config.method) {
      case "cookies":
        // For cookies, use a combination of auth_token and ct0 if available
        cookieAuth = config.data as CookieAuth;
        authTokenCookie = cookieAuth.cookies.find((c) =>
          c.includes("auth_token=")
        );
        ct0Cookie = cookieAuth.cookies.find((c) => c.includes("ct0="));

        if (authTokenCookie && ct0Cookie) {
          authToken = authTokenCookie.split("=")[1].split(";")[0];
          ct0 = ct0Cookie.split("=")[1].split(";")[0];
          return `cookies_${authToken}_${ct0}`;
        }
        return `cookies_${Date.now()}`;

      case "credentials":
        creds = config.data as CredentialsAuth;
        return `credentials_${creds.username}`;

      case "api":
        api = config.data as ApiAuth;
        return `api_${api.apiKey}`;

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
