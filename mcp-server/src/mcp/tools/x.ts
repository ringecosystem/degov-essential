import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { Service } from "typedi";
import { z } from "zod";
import { DegovHelpers } from "../../helpers";
import { McpCommon } from "../common";
import { TwitterAgentW } from "../../internal/x-agent/agentw";
import { FastifyInstance } from "fastify";
import { error } from "console";

@Service()
export class TwitterTools {
  constructor(private readonly twitterAgent: TwitterAgentW) {}

  async regist(fastify: FastifyInstance, server: McpServer) {
    this.registProfiles(fastify, server);
    this.registUser(fastify, server);
    this.registTweets(fastify, server);
  }

  private registProfiles(_fastify: FastifyInstance, server: McpServer) {
    server.registerTool(
      "x-profiles",
      {
        description:
          "List allowed profiles and versions for X (Twitter) clients.",
        inputSchema: {},
        outputSchema: {
          profiles: z.array(z.string().describe("List of allowed profiles")),
        },
      },
      async () => {
        const profiles = this.twitterAgent.allowProfiles();
        const structuredContent = {
          profiles: profiles,
        };
        return {
          structuredContent,
          content: [
            {
              type: "text",
              text: DegovHelpers.safeJsonStringify(structuredContent),
            },
          ],
        };
      }
    );
    server.registerTool(
      "x-profile",
      {
        description: "Get the current x profile info.",
        inputSchema: {
          xprofile: z.string().describe("The profile to use."),
        },
        outputSchema: {
          errors: z.string().describe("Error message").optional(),
          data: z
            .object({
              id: z.string().describe("The user ID"),
              name: z.string().describe("The user's display name").optional(),
              username: z.string().describe("The user's username"),
              verified: z
                .boolean()
                .describe("Whether the user is verified (blue checkmark)")
                .optional(),
              verificationType: z
                .string()
                .describe("Type of verification for the user")
                .optional(),
            })
            .optional(),
        },
      },
      async ({ xprofile }) => {
        console.log("----------------> x-profile", xprofile);
        try {
          const twuser = this.twitterAgent.currentUser({ xprofile: xprofile });
          const structuredContent = {
            data: twuser,
          };
          return {
            structuredContent,
            content: [
              {
                type: "text",
                text: DegovHelpers.safeJsonStringify(structuredContent),
              },
            ],
          };
        } catch (error: any) {
          const message = McpCommon.defaultToolErrorMessage(error);
          const structuredContent = {
            errors: message,
          };
          return {
            structuredContent,
            content: [
              {
                type: "text",
                text: DegovHelpers.safeJsonStringify(structuredContent),
              },
            ],
          };
        }
      }
    );
  }

  private registUser(fastify: FastifyInstance, server: McpServer) {
    server.registerTool(
      "x-user-by-id",
      {
        description: "Get user information by twitter user id.",
        inputSchema: {
          xprofile: z.string().describe("The profile to use.").optional(),

          id: z.string().describe("The user id of the user to retrieve."),
        },
        outputSchema: {
          errors: z.string().describe("Error message").optional(),
          data: z.object(UserV2Schema).optional(),
        },
      },
      async ({ id, xprofile }) => {
        try {
          const result = await this.twitterAgent.getUserById(fastify, {
            xprofile: xprofile,
            id: id,
          });
          const structuredContent = {
            data: result.data,
            errors: McpCommon.stdTwitterError(result.errors),
          };
          return {
            structuredContent,
            content: [
              {
                type: "text",
                text: DegovHelpers.safeJsonStringify(structuredContent),
              },
            ],
          };
        } catch (error: any) {
          const message = McpCommon.defaultToolErrorMessage(error);
          const structuredContent = {
            errors: message,
          };
          return {
            structuredContent,
            content: [
              {
                type: "text",
                text: DegovHelpers.safeJsonStringify(structuredContent),
              },
            ],
          };
        }
      }
    );

    server.registerTool(
      "x-user-by-username",
      {
        description: "Get user information by twitter username.",
        inputSchema: {
          xprofile: z.string().describe("The profile to use.").optional(),

          username: z
            .string()
            .describe("The username of the user to retrieve."),
        },
        outputSchema: {
          errors: z.string().describe("Error message").optional(),
          data: z.object(UserV2Schema).optional(),
        },
      },
      async ({ username, xprofile }) => {
        try {
          const result = await this.twitterAgent.getUserByUsername(fastify, {
            xprofile: xprofile,
            username: username,
          });
          const structuredContent = {
            data: result.data,
            errors: McpCommon.stdTwitterError(result.errors),
          };
          return {
            structuredContent,
            content: [
              {
                type: "text",
                text: DegovHelpers.safeJsonStringify(structuredContent),
              },
            ],
          };
        } catch (error: any) {
          const message = McpCommon.defaultToolErrorMessage(error);
          const structuredContent = {
            errors: message,
          };
          return {
            structuredContent,
            content: [
              {
                type: "text",
                text: DegovHelpers.safeJsonStringify(structuredContent),
              },
            ],
          };
        }
      }
    );
  }

  private registTweets(fastify: FastifyInstance, server: McpServer) {
    server.registerTool(
      "x-search-tweets",
      {
        description: "Search for tweets.",
        inputSchema: {
          xprofile: z.string().describe("The profile to use.").optional(),

          end_time: z
            .string()
            .describe("ISO date string for end time.")
            .optional(),
          start_time: z
            .string()
            .describe("ISO date string for start time.")
            .optional(),
          max_results: z
            .number()
            .describe("Maximum number of results to return.")
            .default(10)
            .optional(),
          since_id: z
            .string()
            .describe("ID of the tweet to start from.")
            .optional(),
          until_id: z
            .string()
            .describe("ID of the tweet to end at.")
            .optional(),
          next_token: z
            .string()
            .describe("Token for the next page of results.")
            .optional(),
          sort_order: z
            .enum(["recency", "relevancy"])
            .describe("Sort order of the results.")
            .default("recency")
            .optional(),
          previous_token: z
            .string()
            .describe("Token for the previous page of results.")
            .optional(),
          query: z.string().describe("The search query to use."),
        },
        outputSchema: {
          data: z.array(z.object(TweetV2Schema)).optional(),
          includes: z
            .object({
              users: z.array(z.object(UserV2Schema)).optional(),
              polls: z.array(PollV2Schema).optional(),
            })
            .optional(),
          errors: z.string().describe("Error message").optional(),
        },
      },
      async (options) => {
        try {
          const result = await this.twitterAgent.searchTweets(fastify, options);
          const structuredContent = {
            data: result.data,
            includes: result.includes,
            errors: McpCommon.stdTwitterError(result.errors),
          };

          // const output = {
          //   data: [
          //     {
          //       id: "1931548219407741357",
          //       text:
          //         "RT @shine20one87371: While others talk about governance…\n" +
          //         "Cardano just operationalized it.\n" +
          //         "No cult. No central control. Just code + communit…",
          //       edit_history_tweet_ids: ["2385245"],
          //     },
          //   ],
          //   // errors: undefined
          // };
          return {
            structuredContent,
            content: [
              {
                type: "text",
                text: DegovHelpers.safeJsonStringify(structuredContent),
              },
            ],
          };
        } catch (error: any) {
          const message = McpCommon.defaultToolErrorMessage(error);
          const structuredContent = {
            errors: message,
          };
          return {
            structuredContent,
            content: [
              {
                type: "text",
                text: DegovHelpers.safeJsonStringify(structuredContent),
              },
            ],
          };
        }
      }
    );

    server.registerTool(
      "x-query-single-tweet",
      {
        description: "Query a single tweet by ID.",
        inputSchema: {
          xprofile: z.string().describe("The profile to use.").optional(),

          id: z.string().describe("The ID of the tweet to retrieve."),
        },
        outputSchema: {
          data: z.object(TweetV2Schema).optional(),
          includes: z
            .object({
              users: z.array(z.object(UserV2Schema)).optional(),
              polls: z.array(PollV2Schema).optional(),
            })
            .optional(),
          errors: z.string().describe("Error message").optional(),
        },
      },
      async (options) => {
        try {
          const result = await this.twitterAgent.getTweetById(fastify, options);
          const structuredContent = {
            data: result.data,
            includes: result.includes,
            errors: McpCommon.stdTwitterError(result.errors),
          };
          return {
            structuredContent,
            content: [
              {
                type: "text",
                text: DegovHelpers.safeJsonStringify(structuredContent),
              },
            ],
          };
        } catch (error: any) {
          const message = McpCommon.defaultToolErrorMessage(error);
          const structuredContent = {
            errors: message,
          };
          return {
            structuredContent,
            content: [
              {
                type: "text",
                text: DegovHelpers.safeJsonStringify(structuredContent),
              },
            ],
          };
        }
      }
    );

    server.registerTool(
      "x-send-tweet",
      {
        description: "Send a tweet.",
        inputSchema: {
          xprofile: z.string().describe("The profile to use.").optional(),
          daocode: z.string().describe("The DAO code"),
          proposal_id: z.string().describe("The proposal ID"),
          chain_id: z.number().describe("The chain ID"),

          ...SendTweetV2ParamsSchema,
        },
        outputSchema: {
          data: z
            .object({
              id: z.string().describe("The ID of the sent tweet"),
              text: z.string().describe("The text of the sent tweet"),
            })
            .optional(),
          errors: z.string().describe("Error message").optional(),
        },
      },
      async (options) => {
        try {
          // @ts-ignore
          const result = await this.twitterAgent.sendTweet(fastify, options);
          const structuredContent = {
            data: result.data,
            errors: McpCommon.stdTwitterError(result.errors),
          };
          return {
            structuredContent,
            content: [
              {
                type: "text",
                text: DegovHelpers.safeJsonStringify(structuredContent),
              },
            ],
          };
        } catch (error: any) {
          const message = McpCommon.defaultToolErrorMessage(error);
          const structuredContent = {
            errors: message,
          };
          return {
            structuredContent,
            content: [
              {
                type: "text",
                text: DegovHelpers.safeJsonStringify(structuredContent),
              },
            ],
          };
        }
      }
    );
  }
}

export const UserV2Schema = {
  id: z.string().describe("The user ID"),
  name: z.string().describe("The user's display name"),
  username: z.string().describe("The user's username"),
  created_at: z
    .string()
    .describe("The date and time when the user was created")
    .optional(),
  protected: z
    .boolean()
    .describe("Whether the user's account is protected (private)")
    .optional(),
  withheld: z
    .object({
      country_codes: z
        .array(z.string())
        .describe("List of country codes where the content is withheld")
        .optional(),
      scope: z
        .enum(["user"])
        .describe("Scope of the withheld content, typically 'user'")
        .optional(),
    })
    .describe("Withheld information for the user")
    .optional(),
  location: z.string().describe("The user's location, if provided").optional(),
  url: z.string().describe("The user's URL, if provided").optional(),
  description: z.string().describe("The user's profile description").optional(),
  verified: z
    .boolean()
    .describe("Whether the user is verified (blue checkmark)")
    .optional(),
  verified_type: z
    .enum(["none", "blue", "business", "government"])
    .describe("Type of verification for the user")
    .optional(),
  entities: z
    .object({
      url: z
        .object({
          urls: z.array(
            z.object({
              start: z.number(),
              end: z.number(),
              url: z.string(),
              expanded_url: z.string(),
              display_url: z.string(),
            })
          ),
        })
        .optional(),
      description: z
        .object({
          urls: z
            .array(
              z.object({
                start: z.number(),
                end: z.number(),
                url: z.string(),
                expanded_url: z.string(),
                display_url: z.string(),
              })
            )
            .optional(),
          hashtags: z
            .array(
              z.object({
                start: z.number(),
                end: z.number(),
                tag: z.string(),
              })
            )
            .optional(),
          cashtags: z
            .array(
              z.object({
                start: z.number(),
                end: z.number(),
                tag: z.string(),
              })
            )
            .optional(),
          mentions: z
            .array(
              z.object({
                start: z.number(),
                end: z.number(),
                username: z.string(),
              })
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),
  profile_image_url: z
    .string()
    .describe("URL of the user's profile image")
    .optional(),
  profile_banner_url: z
    .string()
    .describe("URL of the user's profile banner image")
    .optional(),
  public_metrics: z
    .object({
      followers_count: z.number().optional(),
      following_count: z.number().optional(),
      tweet_count: z.number().optional(),
      listed_count: z.number().optional(),
      like_count: z.number().optional(),
      media_count: z.number().optional(),
    })
    .describe("Public metrics for the user")
    .optional(),
  pinned_tweet_id: z
    .string()
    .describe("ID of the user's pinned tweet")
    .optional(),
  connection_status: z
    .array(z.string())
    .describe("Connection status of the user, e.g., 'following', 'muting'")
    .optional(),
  most_recent_tweet_id: z
    .string()
    .describe("ID of the user's most recent tweet")
    .optional(),
};

export const PollV2Schema = z.object({
  id: z.string(),
  options: z.array(
    z.object({
      position: z.number(),
      label: z.string(),
      votes: z.number(),
    })
  ),
  duration_minutes: z.number().optional(),
  end_datetime: z.string().optional(),
  voting_status: z.string().optional(),
});

export const TweetV2Schema = {
  id: z.string().describe("The tweet ID"),
  text: z.string().describe("The text content of the tweet"),
  edit_history_tweet_ids: z
    .array(z.string())
    .describe("List of edit history tweet IDs"),
  created_at: z
    .string()
    .describe("The date and time when the tweet was created")
    .optional(),
  author_id: z
    .string()
    .describe("The user ID of the tweet's author")
    .optional(),
  conversation_id: z
    .string()
    .describe("The ID of the conversation this tweet belongs to")
    .optional(),
  in_reply_to_user_id: z
    .string()
    .describe("The user ID of the user this tweet is replying to")
    .optional(),
  referenced_tweets: z
    .array(
      z.object({
        type: z.enum(["retweeted", "quoted", "replied_to"]),
        id: z.string(),
      })
    )
    .describe("List of referenced tweets, e.g., retweeted, quoted, replied to")
    .optional(),
  attachments: z
    .object({
      media_keys: z
        .array(z.string())
        .describe("List of media keys attached to the tweet")
        .optional(),
      poll_ids: z
        .array(z.string())
        .describe("List of poll IDs attached to the tweet")
        .optional(),
    })
    .describe("Attachments to the tweet, such as media and polls")
    .optional(),
  geo: z
    .object({
      coordinates: z
        .object({
          type: z.string(),
          coordinates: z.tuple([z.number(), z.number()]).nullable(),
        })
        .describe("Geographical coordinates of the tweet's location")
        .optional(),
      place_id: z.string().describe("Place ID for the tweet's location"),
    })
    .describe("Geographical information of the tweet")
    .optional(),
  context_annotations: z
    .array(
      z.object({
        domain: z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().optional(),
        }),
        entity: z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().optional(),
        }),
      })
    )
    .optional(),
  entities: z
    .object({
      annotations: z
        .array(
          z.object({
            start: z.number(),
            end: z.number(),
            probability: z.number(),
            type: z.string(),
            normalized_text: z.string(),
          })
        )
        .optional(),
      urls: z
        .array(
          z.object({
            start: z.number(),
            end: z.number(),
            url: z.string(),
            expanded_url: z.string(),
            display_url: z.string(),
            unwound_url: z.string(),
            title: z.string().optional(),
            description: z.string().optional(),
            status: z.string().optional(),
            images: z
              .array(
                z.object({
                  url: z.string(),
                  width: z.number(),
                  height: z.number(),
                })
              )
              .optional(),
            media_key: z.string().optional(),
          })
        )
        .optional(),
      hashtags: z
        .array(
          z.object({
            start: z.number(),
            end: z.number(),
            tag: z.string(),
          })
        )
        .optional(),
      cashtags: z
        .array(
          z.object({
            start: z.number(),
            end: z.number(),
            tag: z.string(),
          })
        )
        .optional(),
      mentions: z
        .array(
          z.object({
            start: z.number(),
            end: z.number(),
            username: z.string(),
            id: z.string(),
          })
        )
        .optional(),
    })
    .optional(),
  withheld: z
    .object({
      copyright: z.boolean(),
      country_codes: z.array(z.string()),
      scope: z.enum(["tweet", "user"]),
    })
    .optional(),
  public_metrics: z
    .object({
      retweet_count: z.number(),
      reply_count: z.number(),
      like_count: z.number(),
      quote_count: z.number(),
      impression_count: z.number(),
      bookmark_count: z.number().optional(),
    })
    .optional(),
  non_public_metrics: z
    .object({
      impression_count: z.number(),
      url_link_clicks: z.number(),
      user_profile_clicks: z.number(),
    })
    .optional(),
  organic_metrics: z
    .object({
      impression_count: z.number(),
      url_link_clicks: z.number(),
      user_profile_clicks: z.number(),
      retweet_count: z.number(),
      reply_count: z.number(),
      like_count: z.number(),
    })
    .optional(),
  promoted_metrics: z
    .object({
      impression_count: z.number(),
      url_link_clicks: z.number(),
      user_profile_clicks: z.number(),
      retweet_count: z.number(),
      reply_count: z.number(),
      like_count: z.number(),
    })
    .optional(),
  possibly_sensitive: z.boolean().optional(),
  lang: z.string().optional(),
  reply_settings: z
    .enum(["everyone", "mentionedUsers", "following"])
    .optional(),
  source: z.string().optional(),
  note_tweet: z
    .object({
      text: z.string(),
      entities: z
        .object({
          urls: z
            .array(
              z.object({
                start: z.number(),
                end: z.number(),
                url: z.string(),
                expanded_url: z.string(),
                display_url: z.string(),
              })
            )
            .optional(),
          hashtags: z
            .array(
              z.object({
                start: z.number(),
                end: z.number(),
                tag: z.string(),
              })
            )
            .optional(),
          mentions: z
            .array(
              z.object({
                start: z.number(),
                end: z.number(),
                username: z.string(),
              })
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),
  community_id: z.string().optional(),
};

export const SendTweetV2ParamsSchema = {
  direct_message_deep_link: z
    .string()
    .describe("Direct message deep link to include in the tweet")
    .optional(),
  for_super_followers_only: z
    .enum(["True", "False"])
    .describe("Whether the tweet is only visible to super followers")
    .optional(),
  geo: z
    .object({
      place_id: z
        .string()
        .describe("Place ID for the tweet's location")
        .optional(),
    })
    .describe("Geographical location of the tweet")
    .optional(),
  media: z
    .object({
      media_ids: z
        .array(z.string())
        .min(1)
        .max(4)
        .describe("Media IDs to attach to the tweet")
        .optional(),
      tagged_user_ids: z
        .array(z.string())
        .describe("User IDs tagged in the media")
        .optional(),
    })
    .describe("Media options")
    .optional(),
  poll: z
    .object({
      duration_minutes: z
        .number()
        .describe("Poll duration in minutes")
        .min(5)
        .max(1440),
      options: z.array(z.string()).describe("Poll options").min(2).max(4),
    })
    .describe("Poll options")
    .optional(),
  quote_tweet_id: z.string().describe("ID of the tweet to quote").optional(),
  reply: z
    .object({
      exclude_reply_user_ids: z
        .array(z.string())
        .describe("User IDs to exclude from the reply")
        .optional(),
      in_reply_to_tweet_id: z
        .string()
        .describe("ID of the tweet to reply to")
        .optional(),
    })
    .describe("Reply options")
    .optional(),
  reply_settings: z
    .enum(["mentionedUsers", "following", "everyone"])
    .or(z.string())
    .optional(),
  text: z.string().describe("The text of the tweet to send").optional(),
  community_id: z
    .string()
    .describe("ID of the community to post in")
    .optional(),
};
