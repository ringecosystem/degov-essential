import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { Service } from "typedi";
import { TwitterAgent } from "../../internal/x-agent";
import { z } from "zod";
import { DegovHelpers } from "../../helpers";
import { McpCommon } from "../common";
import { Tweetv2SearchResult, UserV2Result } from "twitter-api-v2";

@Service()
export class TwitterTools {
  constructor(private readonly twitterAgent: TwitterAgent) {}

  async regist(server: McpServer) {
    this.registProfiles(server);
    this.registUser(server);
    this.registTweets(server);
  }

  private registProfiles(server: McpServer) {
    server.registerTool(
      "profiles",
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
        return {
          structuredContent: {
            profiles: profiles,
          },
          content: [
            {
              type: "text",
              text: DegovHelpers.safeJsonStringify(profiles),
            },
          ],
        };
      }
    );
  }

  private registUser(server: McpServer) {
    const userOutputSchema = {
      errors: z.string().describe("Error message").optional(),

      data: z
        .object({
          id: z.string(),
          name: z.string(),
          username: z.string(),
          verified: z.boolean().optional(),
          verified_type: z
            .enum(["none", "blue", "business", "government"])
            .optional(),
          profile_image_url: z.string().optional(),
          profile_banner_url: z.string().optional(),
          pinned_tweet_id: z.string().optional(),
        })
        .optional(),
    };

    function stdOutput(input: UserV2Result) {
      if (!input) {
        return {
          errors: "No user data found.",
        };
      }
      return {
        data: input.data,
        errors: McpCommon.stdTwitterError(input.errors),
      };
    }

    server.registerTool(
      "user-by-id",
      {
        description: "Get user information by twitter user id.",
        inputSchema: {
          id: z.string().describe("The user id of the user to retrieve."),
          profile: z.string().describe("The profile to use.").optional(),
        },
        outputSchema: userOutputSchema,
      },
      async ({ id, profile }) => {
        try {
          const result = await this.twitterAgent.getUserById({
            profile: profile,
            id: id,
          });
          const output = stdOutput(result);
          return {
            structuredContent: output,
            content: [
              {
                type: "text",
                text: DegovHelpers.safeJsonStringify(output),
              },
            ],
          };
        } catch (error: any) {
          const message = McpCommon.defaultToolErrorMessage(error);
          return {
            structuredContent: {
              errors: message,
            },
            content: [
              {
                type: "text",
                text: message,
              },
            ],
          };
        }
      }
    );

    server.registerTool(
      "user-by-username",
      {
        description: "Get user information by twitter username.",
        inputSchema: {
          id: z.string().describe("The username of the user to retrieve."),
          profile: z.string().describe("The profile to use.").optional(),
        },
        outputSchema: userOutputSchema,
      },
      async ({ id, profile }) => {
        try {
          const result = await this.twitterAgent.getUserByUsername({
            profile: profile,
            id: id,
          });
          const output = stdOutput(result);
          return {
            structuredContent: output,
            content: [
              {
                type: "text",
                text: DegovHelpers.safeJsonStringify(output),
              },
            ],
          };
        } catch (error: any) {
          const message = McpCommon.defaultToolErrorMessage(error);
          return {
            structuredContent: {
              errors: message,
            },
            content: [
              {
                type: "text",
                text: message,
              },
            ],
          };
        }
      }
    );
  }

  private registTweets(server: McpServer) {
    function stdOutput(input: Tweetv2SearchResult) {
      if (!input) {
        return {
          errors: "No user data found.",
        };
      }
      return {
        data: input.data,
        errors: McpCommon.stdTwitterError(input.errors),
      };
    }

    server.registerTool(
      "search-tweets",
      {
        description: "Search for tweets.",
        inputSchema: {
          profile: z.string().describe("The profile to use.").optional(),

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
          errors: z.string().describe("Error message").optional(),
        },
      },
      async (options) => {
        try {
          const result = await this.twitterAgent.searchTweets(options);
          const output = stdOutput(result);

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
            structuredContent: output,
            content: [
              {
                type: "text",
                text: DegovHelpers.safeJsonStringify(output),
              },
            ],
          };
        } catch (error: any) {
          const message = McpCommon.defaultToolErrorMessage(error);
          return {
            structuredContent: {
              errors: message,
            },
            content: [
              {
                type: "text",
                text: message,
              },
            ],
          };
        }
      }
    );
  }
}

export const TweetV2Schema = {
  id: z.string(),
  text: z.string(),
  edit_history_tweet_ids: z.array(z.string()),
  created_at: z.string().optional(),
  author_id: z.string().optional(),
  conversation_id: z.string().optional(),
  in_reply_to_user_id: z.string().optional(),
  referenced_tweets: z
    .array(
      z.object({
        type: z.enum(["retweeted", "quoted", "replied_to"]),
        id: z.string(),
      })
    )
    .optional(),
  attachments: z
    .object({
      media_keys: z.array(z.string()).optional(),
      poll_ids: z.array(z.string()).optional(),
    })
    .optional(),
  geo: z
    .object({
      coordinates: z
        .object({
          type: z.string(),
          coordinates: z.tuple([z.number(), z.number()]).nullable(),
        })
        .optional(),
      place_id: z.string(),
    })
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
