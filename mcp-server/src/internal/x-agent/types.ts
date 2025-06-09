import {
  SendTweetV2Params,
  TweetV2PostTweetResult,
  Tweetv2SearchParams,
  TwitterApi,
} from "twitter-api-v2";

export interface AgentClient {
  profile: string;
  user: SimpleTweetUser;
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

export interface SimpleTweetUser {
  id: string;
  name?: string;
  username: string;
  verified?: boolean;
  verificationType?: string;
}

export interface SentTweetHookInput {
  result: TweetV2PostTweetResult;
  tweet: SendTweetInput;
  user: SimpleTweetUser;
}
