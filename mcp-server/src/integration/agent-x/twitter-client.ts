import { Profile, Scraper, SearchMode, Tweet } from "agent-twitter-client";
import { FollowResponse, PollData, TwitterAgentError } from "./types";

export class AgentTwitterClient {
  constructor(private readonly scraper: Scraper) {}

  /**
   * Centralized error handling
   */
  private handleError(error: unknown): never {
    if (error instanceof TwitterAgentError) {
      throw error;
    }
    console.error("Twitter client error:", error);
    throw new TwitterAgentError(
      `Twitter client error: ${(error as Error).message}`,
      "twitter_client_error",
      500
    );
  }

  /**
   * Get a tweet by ID
   */
  async getTweetById(id: string): Promise<Tweet | null> {
    try {
      const tweet = await this.scraper.getTweet(id);
      if (!tweet) {
        throw new TwitterAgentError(
          `Tweet with ID ${id} not found`,
          "tweet_not_found",
          404
        );
      }
      return tweet;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Search for tweets
   */
  async searchTweets(
    query: string,
    count: number,
    searchMode: string = "Top",
    unlimited?: boolean
  ): Promise<Tweet[]> {
    try {
      const mode = this.getSearchMode(searchMode);
      const tweets: Tweet[] = [];
      for await (const tweet of this.scraper.searchTweets(query, count, mode)) {
        tweets.push(tweet);
        if (!unlimited && tweets.length >= count) {
          break;
        }
      }
      return tweets;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Send a tweet
   */
  async sendTweet(
    text: string,
    replyToTweetId?: string,
    media?: { data: string; mediaType: string }[]
  ): Promise<Tweet> {
    try {
      const processedMedia = media?.map((item) => ({
        data: Buffer.from(item.data, "base64"),
        mediaType: item.mediaType,
      }));
      const response = await this.scraper.sendTweet(
        text,
        replyToTweetId,
        processedMedia
      );
      const responseText = await response.text();
      const responseData = JSON.parse(responseText);
      const tweetId =
        responseData?.data?.create_tweet?.tweet_results?.result?.rest_id;
      if (!tweetId) {
        throw new TwitterAgentError(
          "Failed to extract tweet ID from response",
          "tweet_creation_error",
          500
        );
      }
      const tweet = await this.getTweetById(tweetId);
      if (!tweet) {
        throw new TwitterAgentError(
          `Tweet with ID ${tweetId} not found after creation`,
          "tweet_not_found_after_creation",
          404
        );
      }
      return tweet;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Send a tweet with poll
   */
  async sendTweetWithPoll(
    text: string,
    poll: PollData,
    replyToTweetId?: string,
    quotedTweetId?: string
  ): Promise<Tweet> {
    try {
      const response = await this.scraper.sendTweetV2(text, replyToTweetId, {
        poll,
        quoted_tweet_id: quotedTweetId,
      });
      if (!response?.id) {
        throw new TwitterAgentError(
          "Failed to create tweet with poll",
          "poll_creation_error",
          500
        );
      }
      const tweetId = response.id;
      const tweet = await this.getTweetById(tweetId);
      if (!tweet) {
        throw new TwitterAgentError(
          `Tweet with ID ${tweetId} not found after creation`,
          "tweet_not_found_after_creation",
          404
        );
      }
      return tweet;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Like a tweet
   */
  async likeTweet(id: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.scraper.likeTweet(id);
      return {
        success: true,
        message: `Successfully liked tweet with ID ${id}`,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Retweet a tweet
   */
  async retweet(id: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.scraper.retweet(id);
      return {
        success: true,
        message: `Successfully retweeted tweet with ID ${id}`,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Quote a tweet
   */
  async quoteTweet(
    text: string,
    quotedTweetId: string,
    media?: { data: string; mediaType: string }[]
  ): Promise<Tweet> {
    try {
      const processedMedia = media?.map((item) => ({
        data: Buffer.from(item.data, "base64"),
        mediaType: item.mediaType,
      }));
      const response = await this.scraper.sendQuoteTweet(
        text,
        quotedTweetId,
        processedMedia ? { mediaData: processedMedia } : undefined
      );
      const responseText = await response.text();
      const responseData = JSON.parse(responseText);
      const tweetId =
        responseData?.data?.create_tweet?.tweet_results?.result?.rest_id;
      if (!tweetId) {
        throw new TwitterAgentError(
          "Failed to extract tweet ID from quote tweet response",
          "quote_tweet_creation_error",
          500
        );
      }
      const tweet = await this.getTweetById(tweetId);
      if (!tweet) {
        throw new TwitterAgentError(
          `Tweet with ID ${tweetId} not found after quote creation`,
          "tweet_not_found_after_quote_creation",
          404
        );
      }
      return tweet;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get a user's profile
   */
  async getUserProfile(username: string): Promise<Profile> {
    try {
      return await this.scraper.getProfile(username);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Follow a user
   */
  async followUser(username: string): Promise<FollowResponse> {
    try {
      await this.scraper.followUser(username);
      return {
        success: true,
        message: `Successfully followed user @${username}`,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get a user's followers
   */
  async getFollowers(userId: string, count: number): Promise<Profile[]> {
    try {
      const profiles: Profile[] = [];
      for await (const profile of this.scraper.getFollowers(userId, count)) {
        profiles.push(profile);
        if (profiles.length >= count) {
          break;
        }
      }
      return profiles;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get a user's following
   */
  async getFollowing(userId: string, count: number): Promise<Profile[]> {
    try {
      const profiles: Profile[] = [];
      for await (const profile of this.scraper.getFollowing(userId, count)) {
        profiles.push(profile);
        if (profiles.length >= count) {
          break;
        }
      }
      return profiles;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Helper to convert string search mode to SearchMode enum
   */
  private getSearchMode(mode: string): any {
    switch (mode) {
      case "Latest":
        return SearchMode.Latest;
      case "Photos":
        return SearchMode.Photos;
      case "Videos":
        return SearchMode.Videos;
      case "Top":
      default:
        return SearchMode.Top;
    }
  }
}
