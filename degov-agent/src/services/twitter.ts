import { Service } from "typedi";
import {
  DegovTweetStatus,
  QueryTwitterCallback,
  TwitterAuthorizeForm,
  TwitterOAuthType,
} from "../types";
import { FastifyInstance } from "fastify";
import {
  degov_tweet,
  twitter_authorization,
  twitter_poll,
  twitter_poll_option,
  twitter_tweet,
  twitter_user,
} from "../generated/prisma";
import { TwitterApi } from "twitter-api-v2";
import { ConfigReader } from "../integration/config-reader";
import {
  AgentClient,
  SentTweetHookInput,
  TwitterAgent,
} from "../internal/x-agent";
import { TwitterApiRateLimitPlugin } from "@twitter-api-v2/plugin-rate-limit";

export interface AuthorizeResult {
  method: "API";
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
        const twenv = ConfigReader.twitterEnv();

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

    const twenv = ConfigReader.twitterEnv();

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
    const twUser: twitter_user = {
      id: twmed.id,
      name: twmed.name,
      username: twmed.username,
      avatar: twmed.profile_image_url ?? null,
      profile_url: twmed.url ?? null,
      description: twmed.description ?? null,
      verified: twmed.verified ? 1 : 0,
      verified_type: twmed.verified_type ?? null,
      raw: JSON.stringify(twmed),
      ctime: new Date(),
      utime: new Date(),
    };
    await this.modifyUser(fastify, twUser);
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
      include: {
        user: true,
      },
      orderBy: { ctime: "desc" },
    });
    const twenv = ConfigReader.twitterEnv();
    const agentClients: AgentClient[] = [];
    for (const auth of authorizations) {
      if (!auth.user) {
        fastify.log.warn(
          `Twitter authorization for profile "${auth.profile}" has no associated user. Skipping.`
        );
        continue;
      }
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
        user: {
          id: auth.user.id,
          name: auth.user.name ?? undefined,
          username: auth.user.username,
          verified: auth.user.verified ? true : false,
          verificationType: auth.user.verified_type ?? undefined,
        },
        client,
      });
      fastify.log.info(
        `Twitter API client for profile "${auth.profile}" initialized successfully.`
      );
      this.twitterAgent.resetClient(agentClients);
    }
  }

  async getUserById(
    fastify: FastifyInstance,
    options: { id: string }
  ): Promise<twitter_user | null> {
    const prisma = fastify.prisma;
    return await prisma.twitter_user.findFirst({
      where: {
        id: options.id,
      },
    });
  }

  async getUserByUsername(
    fastify: FastifyInstance,
    options: { username: string }
  ): Promise<twitter_user | null> {
    const prisma = fastify.prisma;
    return await prisma.twitter_user.findFirst({
      where: {
        username: options.username,
      },
    });
  }

  async modifyUser(
    fastify: FastifyInstance,
    form: twitter_user
  ): Promise<void> {
    const prisma = fastify.prisma;
    await prisma.twitter_user.upsert({
      where: { id: form.id },
      create: {
        ...form,
        ctime: new Date(),
        utime: new Date(),
      },
      update: {
        name: form.name,
        username: form.username,
        avatar: form.avatar,
        profile_url: form.profile_url,
        description: form.description,
        verified: form.verified ? 1 : 0,
        verified_type: form.verified_type,
        raw: form.raw,
        utime: new Date(),
      },
    });
  }

  async modifyTweets(
    fastify: FastifyInstance,
    forms: twitter_tweet[]
  ): Promise<void> {
    const prisma = fastify.prisma;
    const now = new Date();

    if (!forms || forms.length === 0) return;

    await prisma.$transaction(async (tx) => {
      for (const form of forms) {
        const existing = await tx.twitter_tweet.findUnique({
          where: { id: form.id },
          select: { from_agent: true },
        });

        if (existing) {
          const from_agent = existing.from_agent === 1 ? 1 : form.from_agent;
          await tx.twitter_tweet.update({
            where: { id: form.id },
            data: {
              ...form,
              utime: now,
              from_agent,
            },
          });
        } else {
          await tx.twitter_tweet.create({
            data: {
              ...form,
              ctime: now,
              utime: now,
            },
          });
        }
      }
    });
  }

  async storeSendTweet(
    fastify: FastifyInstance,
    input: SentTweetHookInput
  ): Promise<void> {
    const prisma = fastify.prisma;
    const { user, result, tweet } = input;
    prisma.$transaction(async (tx) => {
      const tweetForm: twitter_tweet = {
        id: result.data.id,
        text: result.data.text,
        created_at: new Date(),
        author_id: user.id,
        retweet_count: 0,
        like_count: 0,
        reply_count: 0,
        ctime: new Date(),
        utime: new Date(),
        conversation_id: null,
        raw: null,
        from_agent: 1,
      };
      let type = "text";
      if (
        tweet.poll &&
        tweet.poll.duration_minutes &&
        tweet.poll.options.length
      ) {
        type = "poll";
      }
      const degovTweetForm: degov_tweet = {
        id: result.data.id,
        daocode: tweet.daocode,
        proposal_id: tweet.proposalId,
        chain_id: tweet.chainId,
        status: DegovTweetStatus.Posted,
        fulfilled: 0,
        reply_next_token: null,
        sync_next_time_reply: null,
        sync_next_time_tweet: null,
        sync_stop_tweet: 0,
        sync_stop_reply: 0,
        times_processed: 0,
        message: null,
        type,
        ctime: new Date(),
        utime: new Date(),
      };
      await tx.twitter_tweet.create({ data: tweetForm });
      await tx.degov_tweet.create({ data: degovTweetForm });
    });
  }

  async getTweetById(
    fastify: FastifyInstance,
    options: { id: string; includeReplies?: boolean }
  ): Promise<twitter_tweet | null> {
    const prisma = fastify.prisma;
    return await prisma.twitter_tweet.findFirst({
      where: {
        id: options.id,
      },
      include: {
        replies: options.includeReplies ? true : false,
      },
    });
  }

  async modifyPoll(
    fastify: FastifyInstance,
    form: {
      poll: twitter_poll;
      options: twitter_poll_option[];
    }
  ) {
    const prisma = fastify.prisma;
    await prisma.$transaction(async (tx) => {
      const existingPoll = await tx.twitter_poll.findUnique({
        where: {
          id: form.poll.id,
        },
      });

      if (existingPoll) {
        await tx.twitter_poll.update({
          where: {
            id: form.poll.id,
          },
          data: {
            ...form.poll,
            utime: new Date(),
          },
        });
      } else {
        await tx.twitter_poll.create({
          data: {
            ...form.poll,
            ctime: new Date(),
            utime: new Date(),
          },
        });
      }

      for (const option of form.options) {
        const existingOption = await tx.twitter_poll_option.findUnique({
          where: {
            code: option.code,
          },
        });

        if (existingOption) {
          await tx.twitter_poll_option.update({
            where: {
              id: existingOption.id,
            },
            data: {
              ...option,
              utime: new Date(),
            },
          });
        } else {
          await tx.twitter_poll_option.create({
            data: {
              ...option,
              id: fastify.snowflake.generate(),
              ctime: new Date(),
              utime: new Date(),
            },
          });
        }
      }
    });
  }

  async queryPoll(
    fastify: FastifyInstance,
    options: { tweetId: string }
  ): Promise<twitter_poll | undefined> {
    const prisma = fastify.prisma;
    const storedTweetPoll = await prisma.twitter_poll.findFirst({
      where: {
        tweet_id: options.tweetId,
      },
      include: {
        twitter_poll_option: true,
      },
    });
    return storedTweetPoll ?? undefined;
  }
}
