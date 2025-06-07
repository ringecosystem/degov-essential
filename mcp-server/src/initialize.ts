import { Service } from "typedi";
import { AuthConfig } from "./integration/agent-x";
import { AuthenticationManager } from "./integration/agent-x/authentication";
import { FastifyInstance } from "fastify";
import { TwitterApi } from "twitter-api-v2";
import { TwitterService } from "./services/twitter";

@Service()
export class DegovMcpServerInitializer {
  constructor(private readonly twitterService: TwitterService) {}

  async init(fastify: FastifyInstance) {
    try {
      // await this.initTwitterAgent(fastify);
      await this.initTwitterApi(fastify);
    } catch (error) {
      console.log(error);
      throw new Error(
        `Failed to initialize: ${error ? (error as Error).message : error}`
      );
    }
  }

  private async initTwitterApi(fastify: FastifyInstance) {
    // const authorizations = await this.twitterService.authorizations(fastify);
    // console.log(authorizations);
    await this.twitterService.loadAuthorization(fastify);
  }

  private async initTwitterAgent(fastify: FastifyInstance) {
    const profiles = process.env.X_PROFILES;
    if (!profiles) {
      throw new Error(
        "No X profiles found in environment variables (`X_PROFILES`)"
      );
    }
    const activeProfile = process.env.X_ACTIVE_PROFILE;
    if (!activeProfile) {
      throw new Error(
        "No active X profile set in environment variables (`X_ACTIVE_PROFILE`)"
      );
    }
    const profileList = profiles.split(",");
    if (!profileList.includes(activeProfile)) {
      throw new Error(
        `Active profile "${activeProfile}" is not in the list of profiles: ${profiles}`
      );
    }

    const am = AuthenticationManager.getInstance();
    let initlizedTwitterAccount = false;
    for (const profile of profileList) {
      const stdProfile = profile.toUpperCase();

      const profileCookie = process.env[`X_${stdProfile}_COOKIES`];

      const profileUsername = process.env[`X_${stdProfile}_USERNAME`];
      const profilePassword = process.env[`X_${stdProfile}_PASSWORD`];
      const profileEmail = process.env[`X_${stdProfile}_EMAIL`];
      const profileTwoFactorSecret = process.env[`X_${stdProfile}_2FA_SECRET`];

      const profileApiKey = process.env[`X_${stdProfile}_API_KEY`];
      const profileApiSecretKey = process.env[`X_${stdProfile}_API_SECRET_KEY`];
      const profileAccessToken = process.env[`X_${stdProfile}_ACCESS_TOKEN`];
      const profileAccessTokenSecret =
        process.env[`X_${stdProfile}_ACCESS_TOKEN`];

      if (profileCookie) {
        const authConfig: AuthConfig = {
          method: "cookies",
          alias: stdProfile,
          data: {
            cookies: JSON.parse(profileCookie),
          },
        };
        console.log(authConfig);
        await am.regist(authConfig);
        initlizedTwitterAccount = true;
        fastify.log.info(
          `Initialized X profile "${stdProfile}" with cookies authentication`
        );
      }
      if (profileUsername && profilePassword) {
        const authConfig: AuthConfig = {
          method: "credentials",
          alias: stdProfile,
          data: {
            username: profileUsername,
            password: profilePassword,
            email: profileEmail,
            twoFactorSecret: profileTwoFactorSecret,
          },
        };
        await am.regist(authConfig);
        initlizedTwitterAccount = true;
        fastify.log.info(
          `Initialized X profile "${stdProfile}" with credentials authentication`
        );
      }
      if (
        profileApiKey &&
        profileApiSecretKey &&
        profileAccessToken &&
        profileAccessTokenSecret
      ) {
        const authConfig: AuthConfig = {
          method: "api",
          alias: stdProfile,
          data: {
            apiKey: profileApiKey,
            apiSecretKey: profileApiSecretKey,
            accessToken: profileAccessToken,
            accessTokenSecret: profileAccessTokenSecret,
          },
        };
        console.log(authConfig);
        await am.regist(authConfig);
        initlizedTwitterAccount = true;
        fastify.log.info(
          `Initialized X profile "${stdProfile}" with API authentication`
        );
      }
    }

    if (!initlizedTwitterAccount) {
      throw new Error(
        "Not a single X profile was initialized. Please check your environment variables."
      );
    }
  }
}
