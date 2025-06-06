import { Service } from "typedi";
import { AuthConfig } from "./integration/agent-x";
import { AuthenticationManager } from "./integration/agent-x/authentication";
import { FastifyInstance } from "fastify";
import { TwitterApi } from "twitter-api-v2";

@Service()
export class DegovMcpServerInitializer {
  async init(fastify: FastifyInstance) {
    try {
      // await this.initTwitterAgent(fastify);
      await this.initTwitterApi(fastify);
    } catch (error) {
      throw new Error(`Failed to initialize: ${(error as Error).message}`);
    }
  }

  private async initTwitterApi(fastify: FastifyInstance) {
    // const twitterClient = new TwitterApi({
    //   appKey: process.env.X_JOKNI2_API_KEY || "defaultApiKey",
    //   appSecret: process.env.X_JOKNI2_API_SECRET_KEY || "consumerAppSecret",
    //   // Following access tokens are not required if you are
    //   // at part 1 of user-auth process (ask for a request token)
    //   // or if you want a app-only client (see below)
    //   accessToken: process.env.X_JOKNI2_ACCESS_TOKEN || "accessOAuthToken",
    //   accessSecret:
    //     process.env.X_JOKNI2_ACCESS_TOKEN_SECRET || "accessOAuthSecret",
    // });
    // const readOnlyClient = twitterClient.readOnly;
    // const user = await readOnlyClient.v2.userByUsername("plhery");
    // console.log(user);

    // const twitterClient = new TwitterApi(
    //   process.env.X_JOKNI2_BEARER_TOKEN || "defaultBearerToken"
    // );

    // // await twitterClient.v1.tweet("Hello, this is a test.");
    // await twitterClient.v2.tweet("Hello, this is a test.");

    // const twitterClient = new TwitterApi({
    //   clientId: process.env.client_id || "defaultClientId",
    //   clientSecret: process.env.client_secret || "defaultClientSecret",
    // });
    // await twitterClient.v2.tweet("Hello, this is a test.");
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
