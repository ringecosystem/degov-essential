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
    const form: twitter_user = this.toTwitterUser(result.data);
    await this.twitterService.modifyUser(fastify, form);
    return result;
  }

  async searchTweets(
    fastify: FastifyInstance,
    options: SearchTweetsInput
  ): Promise<Tweetv2SearchResult> {
    const result = await this.twitterAgent.searchTweets(options);
    const tweets: twitter_tweet[] = [];
    for (const tweet of result.data) {
      const tt: twitter_tweet = {
        id: tweet.id,
        text: tweet.text ?? null,
        created_at: tweet.created_at ? new Date(tweet.created_at) : new Date(),
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
    const form: twitter_tweet = {
      id: result.data.id,
      text: result.data.text ?? null,
      created_at: result.data.created_at
        ? new Date(result.data.created_at)
        : new Date(),
      author_id: result.data.author_id ?? null,
      retweet_count: 0,
      like_count: 0,
      reply_count: 0,
      ctime: new Date(),
      utime: new Date(),
      raw: JSON.stringify(result.data),
      conversation_id: result.data.conversation_id ?? null,
      from_agent: 0,
    };
    await this.twitterService.modifyTweets(fastify, [form]);
    const polls = result.includes?.polls;
    if (polls && polls.length) {
      for (const poll of polls) {
        const pollForm: twitter_poll = {
          id: poll.id,
          tweet_id: result.data.id,
          duration_minutes: poll.duration_minutes ?? null,
          end_datetime: poll.end_datetime ? new Date(poll.end_datetime) : null,
          voting_status: poll.voting_status ?? null,
          ctime: new Date(),
          utime: new Date(),
        };
        const pollOptionsForm = [];
        for (const option of poll.options) {
          const optionCode = DegovHelpers.pollOptionCode({
            id: poll.id,
            label: option.label,
            position: option.position,
          });
          const optionForm: twitter_poll_option = {
            id: "",
            code: optionCode,
            poll_id: poll.id,
            label: option.label,
            votes: option.votes,
            position: option.position,
            ctime: new Date(),
            utime: new Date(),
          };
          pollOptionsForm.push(optionForm);
        }
        await this.twitterService.modifyPoll(fastify, {
          poll: pollForm,
          options: pollOptionsForm,
        });
      }
    }
    return result;
  }

  async sendTweet(
    fastify: FastifyInstance,
    options: SendTweetInput
  ): Promise<TweetV2PostTweetResult> {
    const result = await this.twitterAgent.sendTweet(options);
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
