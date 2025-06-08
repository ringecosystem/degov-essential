import { Service } from "typedi";
import {
  AgentClient,
  GetUserInput,
  PickClientOptions,
  SearchTweetsInput,
} from "./types";
import { Tweetv2SearchResult, TwitterApi, UserV2Result } from "twitter-api-v2";

@Service()
export class TwitterAgent {
  private readonly clients: AgentClient[] = [];

  resetClient(clients: AgentClient[]) {
    this.clients.splice(0, this.clients.length);
    this.clients.push(...clients);
  }

  private pickClient(options: PickClientOptions): AgentClient | undefined {
    const profile = (options.profile ?? "default").toUpperCase();

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

  // getTweetById(options: GetTweetInput) {
  //   const client = this.agentClient(options);
  //   return client.getTweetById(options);
  // }

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
    const paginator = await client.v2.search(options.query, options);
    return paginator.data;
  }
}
