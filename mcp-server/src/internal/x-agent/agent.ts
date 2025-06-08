import { Service } from "typedi";
import {
  AgentClient,
  GetUserInput,
  PickClientOptions,
  SearchTweetsInput,
  SendTweetInput,
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

  allowProfiles(): string[] {
    return this.clients.map((client) => client.profile);
  }

  private agentClient(options: PickClientOptions): TwitterApi {
    const client = this.pickClient(options);
    if (!client) {
      throw new Error(`No client found for profile: ${options.profile}`);
    }
    return client.client;
  }

  async getUserById(options: GetUserInput): Promise<UserV2Result> {
    const client = this.agentClient(options);
    return await client.v2.user(options.id);
  }

  async getUserByUsername(options: GetUserInput): Promise<UserV2Result> {
    const client = this.agentClient(options);
    return await client.v2.userByUsername(options.id);
  }

  async searchTweets(options: SearchTweetsInput): Promise<Tweetv2SearchResult> {
    const client = this.agentClient(options);
    const result = await client.v2.search(options.query, options);
    return result.data;
  }

  async getTweetById(options: GetUserInput): Promise<TweetV2SingleResult> {
    const client = this.agentClient(options);
    return await client.v2.singleTweet(options.id, {
      expansions: ["attachments.poll_ids"],
      "poll.fields": [
        "id",
        "duration_minutes",
        "end_datetime",
        "options",
        "voting_status",
      ],
    });
  }

  async sendTweet(options: SendTweetInput): Promise<TweetV2PostTweetResult> {
    const client = this.agentClient(options);
    const cleanedOptions = cleanObject(options);
    return await client.v2.tweet(cleanedOptions);
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
