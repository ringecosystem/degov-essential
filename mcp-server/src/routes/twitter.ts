import { FastifyInstance, FastifyRequest } from "fastify";
import { Service } from "typedi";
import { EnvReader } from "../integration/envreader";
import { Resp } from "../types";
import { TwitterApi } from "twitter-api-v2";

@Service()
export class TwitterRouter {
  async regist(fastify: FastifyInstance) {
    fastify.get(
      "/twitter/authorize",
      TwitterAuthorizeRequestSchema,
      async (
        request: FastifyRequest<{ Querystring: QueryTwitterAuthorize }>,
        _reply
      ) => {
        const query = request.query;
        const inputProfile = query.profile.trim().toUpperCase();
        const envTwitter = EnvReader.envTwitter();
        if (!envTwitter.profiles().includes(inputProfile)) {
          return Resp.err(
            "Invalid profile provided. Available profiles: " +
              envTwitter.profiles().join(", ")
          );
        }

        let redirectUrl;
        try {
          const apikeypair = envTwitter.apiKeyPair(inputProfile);
          const callbackHost = envTwitter.callbackHost();
          const callbakUrl = `${callbackHost}/twitter/callback?profile=${inputProfile}`;

          const client = new TwitterApi({
            appKey: apikeypair.apiKey,
            appSecret: apikeypair.apiSecretKey,
          });
          const { url, oauth_token, oauth_token_secret } =
            await client.generateAuthLink(callbakUrl, {
              authAccessType: "write",
              // linkMode: "authorize",
            });
          const twitterOAuth: TwitterOAuthType = {
            oauth_token,
            oauth_token_secret,
          };
          // @ts-ignore
          await fastify.cache.set(
            `X_OAUTH_${inputProfile}`,
            twitterOAuth,
            1000 * 60 * 10
          );

          redirectUrl = url;
        } catch (error: any) {
          let message = (error as Error).message;
          if ("data" in error) {
            message = `${message}: ${JSON.stringify(error.data)}`;
          }

          return Resp.err(
            `Failed to retrieve API key pair for profile "${inputProfile}": ${message}`
          );
        }

        return redirectUrl;
      }
    );

    fastify.get(
      "/twitter/callback",
      TwitterCallbackRequestSchema,
      async (
        request: FastifyRequest<{ Querystring: QueryTwitterCallback }>,
        _reply
      ) => {
        const { profile, oauth_token, oauth_verifier } = request.query;

        const inputProfile = profile.trim().toUpperCase();
        const envTwitter = EnvReader.envTwitter();
        if (!envTwitter.profiles().includes(inputProfile)) {
          return Resp.err(
            "Invalid profile provided. Available profiles: " +
              envTwitter.profiles().join(", ")
          );
        }

        const oauthCacheItem = (await fastify.cache.get(
          `X_OAUTH_${inputProfile}`
        )) as TwitterOAuthType | null;
        if (!oauthCacheItem) {
          return Resp.err(
            `No OAuth token found for profile "${inputProfile}". Please initiate the authorization flow first.`
          );
        }
        if (oauthCacheItem.oauth_token !== oauth_token) {
          return Resp.err(
            `OAuth token mismatch for profile "${inputProfile}". Please initiate the authorization flow again.`
          );
        }

        try {
          const apikeypair = envTwitter.apiKeyPair(inputProfile);
          const unauthorizedClient = new TwitterApi({
            appKey: apikeypair.apiKey,
            appSecret: apikeypair.apiSecretKey,
            accessToken: oauth_token,
            accessSecret: oauthCacheItem.oauth_token_secret,
          });
          const { accessToken, accessSecret, screenName, userId } =
            await unauthorizedClient.login(oauth_verifier);
          console.log(
            `accessToken: ${accessToken} accessSecret: ${accessSecret} screenName: ${screenName} userId: ${userId}`
          );
        } catch (error: any) {
          let message = (error as Error).message;
          if ("data" in error) {
            message = `${message}: ${JSON.stringify(error.data)}`;
          }

          return Resp.err(
            `Failed to retrieve API key pair for profile "${inputProfile}": ${message}`
          );
        }

        return Resp.ok("hello");
        // const query = request.query as { profile: string; oauth_token: string; oauth_verifier: string };
        // try {
        //   const { accessToken, accessSecret } =
        //     await client.loginWithOAuth1({
        //       oauth_token: query.oauth_token,
        //       oauth_verifier: query.oauth_verifier,
        //     });
        //   // Redirect to a success page or return a success response
        //   reply.redirect(
        //     `https://your-success-page.com?profile=${inputProfile}&accessToken=${accessToken}&accessSecret=${accessSecret}`
        //   );
        // } catch (error) {
        //   console.error(
        //     `Failed to authenticate with Twitter for profile "${inputProfile}":`,
        //     error
        //   );
        //   return Resp.err(
        //     `Failed to authenticate with Twitter for profile "${inputProfile}": ${error}`
        //   );
        // }
      }
    );
  }
}

const TwitterAuthorizeRequestSchema = {
  schema: {
    querystring: {
      type: "object",
      properties: {
        profile: { type: "string" },
      },
      required: ["profile"],
    },
  },
};

const TwitterCallbackRequestSchema = {
  schema: {
    querystring: {
      type: "object",
      properties: {
        profile: { type: "string" },
        oauth_token: { type: "string" },
        oauth_verifier: { type: "string" },
      },
      required: ["profile", "oauth_token", "oauth_verifier"],
    },
  },
};

interface QueryTwitterAuthorize {
  profile: string;
}

interface QueryTwitterCallback {
  profile: string;
  oauth_token: string;
  oauth_verifier: string;
}

interface TwitterOAuthType {
  oauth_token: string;
  oauth_token_secret: string;
}
