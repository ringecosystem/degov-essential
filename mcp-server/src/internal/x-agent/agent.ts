import { Service } from "typedi";
import {
  AgentClient,
  GetUserInput,
  PickClientOptions,
  SearchTweetsInput,
  SendTweetInput,
  SentTweetHookInput,
  SimpleTweetUser,
} from "./types";
import {
  TweetV2PostTweetResult,
  Tweetv2SearchResult,
  TweetV2SingleResult,
  TwitterApi,
  UserV2Result,
} from "twitter-api-v2";

@Service()
export class TwitterAgent {
  private readonly clients: AgentClient[] = [];
  private hook: ITwitterAgentHook | undefined;

  resetClient(clients: AgentClient[]) {
    this.clients.splice(0, this.clients.length);
    this.clients.push(...clients);
  }

  private pickClient(options: PickClientOptions): AgentClient | undefined {
    const inputProfile = options.profile?.trim().toUpperCase();
    const profile = (!!inputProfile ? inputProfile : "default").toUpperCase();

    return this.clients.find(
      (client) => client.profile.toUpperCase() === profile
    );
  }

  private currentUser(options: PickClientOptions): SimpleTweetUser {
    const client = this.pickClient(options);
    if (!client) {
      throw new Error(`No client found for profile: ${options.profile}`);
    }
    return client.user;
  }

  private agentClient(options: PickClientOptions): TwitterApi {
    const client = this.pickClient(options);
    if (!client) {
      throw new Error(`No client found for profile: ${options.profile}`);
    }
    return client.client;
  }

  private setHook(hook: ITwitterAgentHook) {
    this.hook = hook;
  }

  allowProfiles(): string[] {
    return this.clients.map((client) => client.profile);
  }

  async getUserById(options: GetUserInput): Promise<UserV2Result> {
    const hook = this.hook?.getUserById();
    const cached = await hook?.before(options);
    if (cached) {
      return cached;
    }
    const client = this.agentClient(options);
    const result = await client.v2.user(options.id);
    hook?.after(result);
    return result;
  }

  async getUserByUsername(options: GetUserInput): Promise<UserV2Result> {
    const hook = this.hook?.getUserByUsername();
    const cached = await hook?.before(options);
    if (cached) {
      return cached;
    }
    const client = this.agentClient(options);
    const result = await client.v2.userByUsername(options.id);
    hook?.after(result);
    return result;
  }

  async searchTweets(options: SearchTweetsInput): Promise<Tweetv2SearchResult> {
    const hook = this.hook?.searchTweets();
    const client = this.agentClient(options);
    const result = await client.v2.search(options.query, options);
    const data = result.data;
    if (hook) {
      await hook.after(data);
    }
    return data;
  }

  async getTweetById(options: GetUserInput): Promise<TweetV2SingleResult> {
    const hook = this.hook?.getTweetById();
    const cached = await hook?.before(options);
    if (cached) {
      return cached;
    }

    const client = this.agentClient(options);
    const result = await client.v2.singleTweet(options.id, {
      expansions: ["attachments.poll_ids"],
      "poll.fields": [
        "id",
        "duration_minutes",
        "end_datetime",
        "options",
        "voting_status",
      ],
    });
    await hook?.after(result);
    return result;
  }

  async sendTweet(options: SendTweetInput): Promise<TweetV2PostTweetResult> {
    const client = this.agentClient(options);
    const cleanedOptions = cleanObject(options);
    const result = await client.v2.tweet(cleanedOptions);
    const hook = this.hook?.sendTweet();
    if (hook) {
      const input: SentTweetHookInput = {
        result,
        tweet: cleanedOptions,
        user: this.currentUser(options),
      };
      await hook.after(input);
    }
    return result;
  }
}

function cleanObject(obj: any): any {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([_, value]) =>
        value !== "" && // clean empty strings
        value !== null && // clean null
        value !== undefined && // clean undefined
        (Array.isArray(value) ? value.length > 0 : true) && // clean empty arrays
        (typeof value === "object" && !Array.isArray(value)
          ? Object.keys(value).length > 0
          : true) // clean empty objects
    )
  );
}

export interface ITwitterAgentHook {
  getUserById(): ITweetHookAll<GetUserInput, UserV2Result> | undefined;
  getUserByUsername(): ITweetHookAll<GetUserInput, UserV2Result> | undefined;
  searchTweets(): ITweetHookAfter<Tweetv2SearchResult> | undefined;
  getTweetById(): ITweetHookAll<GetUserInput, TweetV2SingleResult> | undefined;
  sendTweet(): ITweetHookAfter<SentTweetHookInput> | undefined;
}

export interface ITweetHookAfter<INPUT> {
  after(input: INPUT): Promise<void>;
}

export interface ITweetHookAll<BEFORE_INPUT, AFTER_INPUT>
  extends ITweetHookAfter<AFTER_INPUT> {
  before(input: BEFORE_INPUT): Promise<AFTER_INPUT | undefined>;
}
