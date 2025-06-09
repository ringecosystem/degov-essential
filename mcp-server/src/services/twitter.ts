import { Service } from "typedi";
import {
  QueryTwitterCallback,
  TwitterAuthorizeForm,
  TwitterOAuthType,
} from "../types";
import { FastifyInstance } from "fastify";
import { twitter_authorization, twitter_user } from "../generated/prisma";
import { TwitterApi } from "twitter-api-v2";
import { EnvReader } from "../integration/envreader";
import { AgentClient, TwitterAgent } from "../internal/x-agent";
import { TwitterApiRateLimitPlugin } from "@twitter-api-v2/plugin-rate-limit";

export interface AuthorizeResult {
  method: "COOKIES" | "API";
  message?: string;
  oauthUrl?: string;
}

export interface TwitterAuthorizeCallbackResult {
  result: "ok" | "error";
  message?: string;
  profile?: twitter_user;
}

@Service()
export class TwitterService {
  constructor(private readonly twitterAgent: TwitterAgent) {}

  async authorize(
    fastify: FastifyInstance,
    form: TwitterAuthorizeForm
  ): Promise<AuthorizeResult> {
    const prisma = fastify.prisma;
    const inputProfile = (form.profile ?? "default").trim().toUpperCase();
    const method = form.method.trim().toUpperCase();
    let twitterAuthorization: twitter_authorization | undefined;
    let oauthUrl: string | undefined;
    switch (method) {
      case "API": {
        const twenv = EnvReader.twitterEnv();

        const storedAuthorization =
          await prisma.twitter_authorization.findFirst({
            where: {
              profile: inputProfile,
            },
          });
        if (storedAuthorization) {
          return {
            method,
            message: "This profile already has an authorization.",
          };
        }

        const client = new TwitterApi({
          appKey: twenv.apiKey,
          appSecret: twenv.apiSecretKey,
        });

        const callbakUrl = `${twenv.callbackHost}/twitter/authorized?profile=${inputProfile}`;

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
          1000 * 60 * 5
        );

        twitterAuthorization = {
          id: fastify.snowflake.generate(),
          profile: inputProfile,
          description: null,
          enabled: 0,
          access_token: null,
          access_secret: null,
          user_id: null,
          ctime: new Date(),
          utime: new Date(),
        };
        oauthUrl = url;
        break;
      }
      default: {
        throw new Error(
          `Invalid method "${method}" provided. Supported methods are: API.`
        );
      }
    }
    if (!twitterAuthorization) {
      throw new Error("Twitter authorization could not be created.");
    }

    await prisma.twitter_authorization.create({
      data: {
        ...twitterAuthorization,
      },
    });
    return {
      method,
      message: "Twitter authorization created successfully.",
      oauthUrl,
    };
  }

  async callback(
    fastify: FastifyInstance,
    query: QueryTwitterCallback
  ): Promise<TwitterAuthorizeCallbackResult> {
    const { profile, oauth_token, oauth_verifier } = query;
    const inputProfile = profile.trim().toUpperCase();

    const prisma = fastify.prisma;

    const storedAuthorization = await prisma.twitter_authorization.findFirst({
      where: {
        profile: inputProfile,
      },
    });
    if (!storedAuthorization) {
      throw new Error(
        `No Twitter authorization found for profile "${inputProfile}". Please initiate the authorization flow first.`
      );
    }

    const cachedOauth = (await fastify.cache.get(
      `X_OAUTH_${inputProfile}`
    )) as TwitterOAuthType | null;
    if (!cachedOauth) {
      throw new Error(
        `No OAuth data found for profile "${inputProfile}". Please initiate the authorization flow first.`
      );
    }
    if (cachedOauth.oauth_token !== oauth_token) {
      throw new Error(
        `OAuth token mismatch for profile "${inputProfile}". Please initiate the authorization flow again.`
      );
    }

    const twenv = EnvReader.twitterEnv();

    const unauthorizedClient = new TwitterApi({
      appKey: twenv.apiKey!,
      appSecret: twenv.apiSecretKey!,
      accessToken: oauth_token,
      accessSecret: cachedOauth.oauth_token_secret,
    });

    const { accessToken, accessSecret, client } =
      await unauthorizedClient.login(oauth_verifier);

    const twme = await client.v2.me();
    if (twme.errors) {
      fastify.log.warn(
        `Failed to fetch Twitter user info for profile "${inputProfile}": ${JSON.stringify(
          twme.errors
        )}`
      );
      return { result: "ok" };
    }

    const twmed = twme.data;
    const twUser = {
      id: twmed.id,
      name: twmed.name,
      username: twmed.username,
      avatar: twmed.profile_image_url,
      profile_url: twmed.url,
      description: twmed.description,
      verified: twmed.verified ? 1 : 0,
      verified_type: twmed.verified_type,
      raw: JSON.stringify(twmed),
      ctime: new Date(),
      utime: new Date(),
    };
    await prisma.twitter_user.upsert({
      where: { id: twmed.id },
      create: twUser,
      update: twUser,
    });
    const xuser = await prisma.twitter_user.findFirst({
      where: { id: twmed.id },
    });

    await prisma.twitter_authorization.update({
      where: { id: storedAuthorization.id },
      data: {
        access_token: accessToken,
        access_secret: accessSecret,
        enabled: 1,
        user_id: twmed.id,
        utime: new Date(),
      },
    });

    await this.loadAuthorization(fastify);
    return { result: "ok", profile: xuser ?? undefined };
  }

  async loadAuthorization(fastify: FastifyInstance): Promise<void> {
    const prisma = fastify.prisma;
    const authorizations = await prisma.twitter_authorization.findMany({
      where: {
        enabled: 1,
      },
      orderBy: { ctime: "desc" },
    });
    const twenv = EnvReader.twitterEnv();
    const agentClients: AgentClient[] = [];
    for (const auth of authorizations) {
      const { access_token, access_secret } = auth;

      if (!access_token || !access_secret) {
        fastify.log.warn(
          `Twitter authorization for profile "${auth.profile}" has no access token or secret set. Skipping.`
        );
        continue;
      }
      const rateLimitPlugin = new TwitterApiRateLimitPlugin();
      const client = new TwitterApi(
        {
          appKey: twenv.apiKey,
          appSecret: twenv.apiSecretKey,
          accessToken: access_token,
          accessSecret: access_secret,
        },
        { plugins: [rateLimitPlugin] }
      );

      agentClients.push({
        profile: auth.profile,
        client,
      });
      fastify.log.info(
        `Twitter API client for profile "${auth.profile}" initialized successfully.`
      );
      this.twitterAgent.resetClient(agentClients);
    }
  }
}
