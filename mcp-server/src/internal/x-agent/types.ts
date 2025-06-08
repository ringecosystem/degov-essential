import {
  SendTweetV2Params,
  Tweetv2SearchParams,
  TwitterApi,
} from "twitter-api-v2";

export interface AgentClient {
  profile: string;
  client: TwitterApi;
}

export interface RecommendedProfileOptions {
  allowV1?: boolean;
}

export interface PickClientOptions {
  profile?: string;
}

export interface GetTweetInput extends PickClientOptions {
  id: string;
}

export interface GetUserInput extends PickClientOptions {
  id: string;
}

export interface SearchTweetsInput
  extends PickClientOptions,
    Tweetv2SearchParams {}

export interface SendTweetInput extends PickClientOptions, SendTweetV2Params {}
