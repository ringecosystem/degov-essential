import { Service } from "typedi";
import {
  AgentClient,
  GetByIdInput,
  GetUserByUserameInput,
  PickClientOptions,
  SearchTweetsInput,
  SendTweetInput,
  SimpleTweetUser,
} from "./types";
import {
  TTweetv2TweetField,
  TweetV2PostTweetResult,
  Tweetv2SearchResult,
  TweetV2SingleResult,
  TwitterApi,
  UserV2Result,
} from "twitter-api-v2";

const DEFAULT_TWEET_FIELDS: TTweetv2TweetField[] = [
  "article",
  "attachments",
  "author_id",
  "context_annotations",
  "conversation_id",
  "created_at",
  "id",
  "in_reply_to_user_id",
  "lang",
  "public_metrics",
  "organic_metrics",
  "edit_controls",
  "possibly_sensitive",
  "referenced_tweets",
  "reply_settings",
  "source",
  "text",
  "withheld",
  "note_tweet",
  "edit_history_tweet_ids",
];

@Service()
export class TwitterAgent {
  private readonly clients: AgentClient[] = [];

  resetClient(clients: AgentClient[]) {
    this.clients.splice(0, this.clients.length);
    this.clients.push(...clients);
  }

  private pickClient(options: PickClientOptions): AgentClient | undefined {
    const inputProfile = options.xprofile?.trim().toUpperCase();
    const profile = (!!inputProfile ? inputProfile : "default").toUpperCase();

    return this.clients.find(
      (client) => client.profile.toUpperCase() === profile
    );
  }

  private agentClient(options: PickClientOptions): TwitterApi {
    const client = this.pickClient(options);
    if (!client) {
      throw new Error(`No client found for profile: ${options.xprofile}`);
    }
    return client.client;
  }

  currentUser(options: PickClientOptions): SimpleTweetUser {
    const client = this.pickClient(options);
    if (!client) {
      throw new Error(`No client found for profile: ${options.xprofile}`);
    }
    return client.user;
  }

  allowProfiles(): string[] {
    return this.clients.map((client) => client.profile);
  }

  async getUserById(options: GetByIdInput): Promise<UserV2Result> {
    const client = this.agentClient(options);
    return await client.v2.user(options.id);
  }

  async getUserByUsername(
    options: GetUserByUserameInput
  ): Promise<UserV2Result> {
    const client = this.agentClient(options);
    return await client.v2.userByUsername(options.username);
  }

  async searchTweets(options: SearchTweetsInput): Promise<Tweetv2SearchResult> {
    const client = this.agentClient(options);
    const result = await client.v2.search(options.query, {
      ...cleanTwitterParameter(options),
      expansions: ["author_id"], //  "attachments.poll_ids"
      // "poll.fields": [
      //   "id",
      //   "duration_minutes",
      //   "end_datetime",
      //   "options",
      //   "voting_status",
      // ],
      "tweet.fields": DEFAULT_TWEET_FIELDS,
    });

    return result.data;
  }

  async getTweetById(options: GetByIdInput): Promise<TweetV2SingleResult> {
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
      "tweet.fields": DEFAULT_TWEET_FIELDS,
    });
    return result;
  }

  async sendTweet(options: SendTweetInput): Promise<TweetV2PostTweetResult> {
    const client = this.agentClient(options);
    const cleanedOptions = cleanTwitterParameter({ ...options });
    return await client.v2.tweet(cleanedOptions);
  }
}

function cleanTwitterParameter(obj: any): any {
  const result = Object.fromEntries(
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
  delete result.xprofile;
  delete result.daoname;
  delete result.daocode;
  delete result.chainId;
  delete result.proposalId;
  return result;
}
