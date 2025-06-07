import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Service } from "typedi";
import { EnvReader } from "../integration/envreader";
import { QueryTwitterCallback, Resp, TwitterAuthorizeForm } from "../types";
import { TwitterApi } from "twitter-api-v2";
import { AuthenticationManager } from "../integration/agent-x/authentication";
import { ATwitterClient } from "../integration/agent-x";
import { TwitterService } from "../services/twitter";

@Service()
export class TwitterRouter {
  constructor(private readonly twitterService: TwitterService) {}

  async regist(fastify: FastifyInstance) {
    fastify.get("/twitter/account", async (request, reply) => {
      return reply.view("twitter-account.handlebars", {});
    });

    fastify.post(
      "/twitter/authorize",
      TwitterAuthorizeRequestSchema,
      async (
        request: FastifyRequest<{ Body: TwitterAuthorizeForm }>,
        _reply
      ) => {
        const result = await this.twitterService.authorize(
          fastify,
          request.body
        );
        return Resp.ok(result);
      }
    );

    fastify.get(
      "/twitter/authorized",
      TwitterCallbackRequestSchema,
      async (
        request: FastifyRequest<{ Querystring: QueryTwitterCallback }>,
        reply: FastifyReply
      ) => {
        try {
          const result = await this.twitterService.callback(
            fastify,
            request.query
          );
          return reply.view("twitter-authorized.handlebars", {
            auth: result.profile,
          });
        } catch (e: any) {
          const message = `An error occurred while processing your request: ${e.message}`;
          return reply.view("error.handlebars", {
            error: {
              message: message,
              detail: JSON.stringify(e.data),
              stack: e.stack,
            },
          });
        }
      }
    );
  }
}

const TwitterCallbackRequestSchema = {
  schema: {
    querystring: {
      type: "object",
      properties: {
        profile: { type: "string" },
        oauth_token: { type: "string" },
        oauth_verifier: { type: "string" },
      },
      required: ["profile", "oauth_token", "oauth_verifier"],
    },
  },
};

const TwitterAuthorizeRequestSchema = {
  schema: {
    body: {
      type: "object",
      properties: {
        profile: { type: "string" },
        method: { type: "string", enum: ["cookies", "api"] },
        auth_token: { type: "string" },
        ct0: { type: "string" },
        twid: { type: "string" },
        api_key: { type: "string" },
        api_secret_key: { type: "string" },
      },
      required: ["profile", "method"],
      oneOf: [
        {
          required: ["auth_token", "ct0", "twid"],
          properties: { method: { const: "cookies" } },
        },
        {
          required: ["api_key", "api_secret_key"],
          properties: { method: { const: "api" } },
        },
      ],
    },
  },
};
