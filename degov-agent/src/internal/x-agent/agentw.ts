import { Service } from "typedi";
import { TwitterAgent } from "./agent";
import {
  GetUserByUserameInput,
  GetByIdInput,
  PickClientOptions,
  SearchTweetsInput,
  SendTweetInput,
  SimpleTweetUser,
  SentTweetHookInput,
  ForceQueryDegovTwitter,
} from "./types";
import {
  TweetV2PostTweetResult,
  Tweetv2SearchResult,
  TweetV2SingleResult,
  UserV2,
  UserV2Result,
} from "twitter-api-v2";
import { TwitterService } from "../../services/twitter";
import { FastifyInstance } from "fastify";
import {
  twitter_poll,
  twitter_poll_option,
  twitter_tweet,
  twitter_user,
} from "../../generated/prisma";
import { DegovHelpers } from "../../helpers";

@Service()
export class TwitterAgentW {
  constructor(
    private readonly twitterService: TwitterService,
    private readonly twitterAgent: TwitterAgent
  ) {}

  private toTwitterUser(userv2: UserV2): twitter_user {
    return {
      id: userv2.id,
      username: userv2.username,
      description: userv2.description ?? null,
      name: userv2.name ?? null,
      verified:
        typeof userv2.verified === "boolean" ? (userv2.verified ? 1 : 0) : null,
      verified_type: (userv2.verified_type ?? null) as string | null,
      avatar: userv2.profile_image_url ?? null,
      profile_url: userv2.url ?? null,
      ctime: new Date(),
      utime: new Date(),
      raw: JSON.stringify(userv2),
    };
  }

  currentUser(options: PickClientOptions): SimpleTweetUser {
    return this.twitterAgent.currentUser(options);
  }

  allowProfiles(): string[] {
    return this.twitterAgent.allowProfiles();
  }

  async getUserById(
    fastify: FastifyInstance,
    options: GetByIdInput & ForceQueryDegovTwitter
  ): Promise<UserV2Result> {
    const forceQuery = options.force ?? false;
    if (!forceQuery) {
      const cached = await this.twitterService.getUserById(fastify, options);
      if (cached) {
        return {
          data: JSON.parse(cached.raw),
          includes: undefined,
          errors: undefined,
        };
      }
    }
    const result = await this.twitterAgent.getUserById(options);
    if (result.errors) {
      throw new Error(
        `Error fetching user by ID ${options.id}: ${JSON.stringify(
          result.errors
        )}`
      );
    }
    const form: twitter_user = this.toTwitterUser(result.data);
    await this.twitterService.modifyUser(fastify, form);
    return result;
  }

  async getUserByUsername(
    fastify: FastifyInstance,
    options: GetUserByUserameInput & ForceQueryDegovTwitter
  ): Promise<UserV2Result> {
    const forceQuery = options.force ?? false;
    if (!forceQuery) {
      const cached = await this.twitterService.getUserByUsername(
        fastify,
        options
      );
      if (cached) {
        return {
          data: JSON.parse(cached.raw),
          includes: undefined,
          errors: undefined,
        };
      }
    }
    const result = await this.twitterAgent.getUserByUsername(options);
    if (result.errors) {
      throw new Error(
        `Error fetching user by username "${
          options.username
        }": ${JSON.stringify(result.errors)}`
      );
    }
    const form: twitter_user = this.toTwitterUser(result.data);
    await this.twitterService.modifyUser(fastify, form);
    return result;
  }

  async searchTweets(
    fastify: FastifyInstance,
    options: SearchTweetsInput
  ): Promise<Tweetv2SearchResult> {
    const result = await this.twitterAgent.searchTweets(options);
    if (result.errors) {
      throw new Error(
        `Error searching tweets with query "${options.query}": ${JSON.stringify(
          result.errors
        )}`
      );
    }
    if (result.meta.result_count > 0) {
      const tweets: twitter_tweet[] = [];
      for (const tweet of result.data) {
        const tt: twitter_tweet = {
          id: tweet.id,
          text: tweet.text ?? null,
          created_at: tweet.created_at
            ? new Date(tweet.created_at)
            : new Date(),
          author_id: tweet.author_id ?? null,
          retweet_count: 0,
          like_count: 0,
          reply_count: 0,
          ctime: new Date(),
          utime: new Date(),
          raw: JSON.stringify(tweet),
          conversation_id: tweet.conversation_id ?? null,
          from_agent: 0,
        };
        tweets.push(tt);
      }
      await this.twitterService.modifyTweets(fastify, tweets);
    }
    return result;
  }

  async getTweetById(
    fastify: FastifyInstance,
    options: GetByIdInput & ForceQueryDegovTwitter
  ): Promise<TweetV2SingleResult> {
    const forceQuery = options.force ?? false;
    if (!forceQuery) {
      const cached = await this.twitterService.getTweetById(fastify, options);
      if (cached && cached.raw) {
        return {
          data: JSON.parse(cached.raw),
          includes: undefined,
          errors: undefined,
        };
      }
    }
    const result = await this.twitterAgent.getTweetById(options);
    if (result.errors) {
      throw new Error(
        `Error fetching tweet by ID ${options.id}: ${JSON.stringify(
          result.errors
        )}`
      );
    }
    const tweet = result.data;
    const form: twitter_tweet = {
      id: tweet.id,
      text: tweet.text ?? null,
      created_at: tweet.created_at ? new Date(tweet.created_at) : new Date(),
      author_id: tweet.author_id ?? null,
      retweet_count: tweet.public_metrics?.retweet_count ?? 0,
      like_count: tweet.public_metrics?.like_count ?? 0,
      reply_count: tweet.public_metrics?.reply_count ?? 0,
      ctime: new Date(),
      utime: new Date(),
      raw: JSON.stringify(tweet),
      conversation_id: tweet.conversation_id ?? null,
      from_agent: 0,
    };
    await this.twitterService.modifyTweets(fastify, [form]);
    const polls = result.includes?.polls;
    await this.twitterService.modifyPolls(fastify, {
      tweetId: tweet.id,
      polls: polls ?? [],
    });
    return result;
  }

  async sendTweet(
    fastify: FastifyInstance,
    options: SendTweetInput
  ): Promise<TweetV2PostTweetResult> {
    const result = await this.twitterAgent.sendTweet(options);
    if (result.errors) {
      throw new Error(`Error sending tweet: ${JSON.stringify(result.errors)}`);
    }
    const user = this.twitterAgent.currentUser(options);
    const input: SentTweetHookInput = {
      result: result,
      tweet: options,
      user: user,
    };
    await this.twitterService.storeSendTweet(fastify, input);
    return result;
  }
}
