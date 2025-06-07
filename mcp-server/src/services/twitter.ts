import { Service } from "typedi";
import {
  QueryTwitterCallback,
  TwitterAuthorizeForm,
  TwitterOAuthType,
} from "../types";
import { AuthenticationManager } from "../integration/x-scraper/authentication";
import { FastifyInstance } from "fastify";
import { twitter_authorization, twitter_user } from "../generated/prisma";
import { TwitterApi } from "twitter-api-v2";
import { EnvReader } from "../integration/envreader";
import { ScraperTwitterClient } from "../integration/x-scraper";

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
      case "COOKIES": {
        const am = AuthenticationManager.getInstance();
        let cookieTwid = (form.twid ?? "").trim();
        if (!cookieTwid.startsWith("u%3")) {
          cookieTwid = `u%3D${cookieTwid}`;
        }
        const cookies = [
          `auth_token=${form.auth_token}; Domain=.twitter.com`,
          `ct0=${form.ct0}; Domain=.twitter.com`,
          `twid=${cookieTwid}; Domain=.twitter.com`,
        ];
        const registered = await am.regist(
          {
            method: "cookies",
            alias: inputProfile,
            data: {
              cookies,
            },
          },
          { force: true }
        );
        const storedAuthorization =
          await prisma.twitter_authorization.findFirst({
            where: {
              profile: inputProfile,
              version: "v1",
            },
          });
        if (storedAuthorization) {
          twitterAuthorization = {
            ...storedAuthorization,
            cookies: cookies.join(";"),
          };
        } else {
          twitterAuthorization = {
            id: "",
            profile: inputProfile,
            description: null,
            version: "v1",
            enabled: 1,
            auth_method: "cookies",
            cookies: cookies.join(";"),
            access_token: null,
            access_secret: null,
            api_key: null,
            api_secret_key: null,
            ctime: new Date(),
            utime: new Date(),
          };
        }
        break;
      }
      case "API": {
        const appKey = form.api_key;
        const appSecret = form.api_secret_key;
        if (!appKey) {
          throw new Error("API key is required for API method.");
        }
        if (!appSecret) {
          throw new Error("API secret key is required for API method.");
        }

        const storedAuthorization =
          await prisma.twitter_authorization.findFirst({
            where: {
              profile: inputProfile,
              version: "v2",
            },
          });
        if (storedAuthorization) {
          if (
            storedAuthorization.api_key === appKey &&
            storedAuthorization.api_secret_key === appSecret
          ) {
            return {
              method,
              message: "Twitter API keys already registered.",
            };
          }
        }

        const client = new TwitterApi({
          appKey,
          appSecret,
        });

        const callbackHost = EnvReader.xCallbackHost();
        const callbakUrl = `${callbackHost}/twitter/authorized?profile=${inputProfile}`;

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

        if (storedAuthorization) {
          twitterAuthorization = {
            ...storedAuthorization,
            api_key: appKey,
            api_secret_key: appSecret,
            access_token: null,
            access_secret: null,
            enabled: 0,
          };
        } else {
          twitterAuthorization = {
            id: "",
            profile: inputProfile,
            description: null,
            version: "v2",
            enabled: 0,
            auth_method: "api",
            cookies: null,
            access_token: null,
            access_secret: null,
            api_key: appKey,
            api_secret_key: appSecret,
            ctime: new Date(),
            utime: new Date(),
          };
        }
        oauthUrl = url;
        break;
      }
      default: {
        throw new Error(
          `Invalid method "${method}" provided. Supported methods are: COOKIES, API.`
        );
      }
    }
    if (!twitterAuthorization) {
      throw new Error("Twitter authorization could not be created.");
    }
    if (twitterAuthorization.id) {
      // Update existing authorization
      await prisma.twitter_authorization.update({
        where: { id: twitterAuthorization.id },
        data: {
          ...twitterAuthorization,
          utime: new Date(),
        },
      });
      return {
        method,
        message: "Twitter authorization updated successfully.",
      };
    }

    await prisma.twitter_authorization.create({
      data: {
        ...twitterAuthorization,
        id: fastify.snowflake.generate(),
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
        version: "v2",
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
    const appKey = storedAuthorization.api_key;
    const appSecret = storedAuthorization.api_secret_key;
    if (!appKey || !appSecret) {
      throw new Error(
        `API keys are not set for profile "${inputProfile}". Please check your Twitter API configuration.`
      );
    }

    const unauthorizedClient = new TwitterApi({
      appKey,
      appSecret,
      accessToken: oauth_token,
      accessSecret: cachedOauth.oauth_token_secret,
    });
    // , screenName, userId
    const { accessToken, accessSecret, client } =
      await unauthorizedClient.login(oauth_verifier);

    await prisma.twitter_authorization.update({
      where: { id: storedAuthorization.id },
      data: {
        access_token: accessToken,
        access_secret: accessSecret,
        enabled: 1,
        utime: new Date(),
      },
    });

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

    await prisma.twitter_user.upsert({
      where: { twid: twmed.id },
      create: {
        id: fastify.snowflake.generate(),
        twid: twmed.id,
        name: twmed.name,
        username: twmed.username,
        avatar: twmed.profile_image_url,
        profile_url: twmed.url,
        description: twmed.description,
        verified: twmed.verified ? 1 : 0,
        verified_type: twmed.verified_type,
        ctime: new Date(),
      },
      update: {
        twid: twmed.id,
        name: twmed.name,
        username: twmed.username,
        avatar: twmed.profile_image_url,
        profile_url: twmed.url,
        description: twmed.description,
        verified: twmed.verified ? 1 : 0,
        verified_type: twmed.verified_type,
        utime: new Date(),
      },
    });
    const xuser = await prisma.twitter_user.findFirst({
      where: { twid: twmed.id },
    });

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
    console.log(authorizations);
    for (const auth of authorizations) {
      const authMethod = auth.auth_method.toUpperCase();
      switch (authMethod) {
        case "COOKIES": {
          const am = AuthenticationManager.getInstance();
          if (!auth.cookies) {
            fastify.log.warn(
              `Twitter authorization for profile "${auth.profile}" has no cookies set. Skipping.`
            );
            continue;
          }
          const cookies = auth.cookies?.split(";").map((c) => c.trim()) ?? [];
          const regResult = await am.regist(
            {
              method: "cookies",
              alias: auth.profile,
              data: {
                cookies,
              },
            },
            { force: true }
          );
          const atc = new ScraperTwitterClient(regResult.scraper);

          break;
        }
        case "API": {
          const { api_key, api_secret_key, access_token, access_secret } = auth;
          if (!api_key || !api_secret_key) {
            fastify.log.warn(
              `Twitter authorization for profile "${auth.profile}" has no API keys set. Skipping.`
            );
            continue;
          }
          if (!access_token || !access_secret) {
            fastify.log.warn(
              `Twitter authorization for profile "${auth.profile}" has no access token or secret set. Skipping.`
            );
            continue;
          }
          const client = new TwitterApi({
            appKey: api_key,
            appSecret: api_secret_key,
            accessToken: access_token,
            accessSecret: access_secret,
          });
        }
        default: {
          fastify.log.warn(
            `Unsupported Twitter authorization method "${authMethod}" for profile "${auth.profile}".`
          );
          continue;
        }
      }
    }
  }
}
