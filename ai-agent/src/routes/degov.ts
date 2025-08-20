import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Service } from "typedi";
import { DegovSummaryForm, Resp } from "../types";
import { DaoService } from "../services/dao";
import { DegovService } from "../services/degov";
import { DegovContract } from "../internal/contracts";
import { TwitterAgentW } from "../internal/x-agent/agentw";

@Service()
export class DegovRouter {
  constructor(
    private readonly daoService: DaoService,
    private readonly degovService: DegovService,
    private readonly twitterAgent: TwitterAgentW,
    private readonly degovContract: DegovContract
  ) {}

  async regist(fastify: FastifyInstance) {
    fastify.get("/degov/daos", async (_request, _reply) => {
      const daos = await this.daoService.daos(fastify);
      return Resp.ok(daos);
    });

    fastify.get("/degov/bot-address", async (_request, _reply) => {
      const address = this.degovContract.botAccoutAddress();
      return Resp.ok({ address });
    });

    fastify.post(
      "/degov/proposal/summary",
      DegovSummaryRequestSchema,
      async (request: FastifyRequest<{ Body: DegovSummaryForm }>, _reply) => {
        const body = request.body;
        const summary = await this.degovService.generateProposalSummary(
          fastify,
          body
        );
        return Resp.ok(summary);
      }
    );

    fastify.get(
      "/degov/vote/:chain/:id",
      DegovVoteRequestSchema,
      async (
        request: FastifyRequest<{
          Params: { chain: number; id: string };
          Querystring: { format?: string; fulfilled?: number };
        }>,
        reply: FastifyReply
      ) => {
        const { chain, id } = request.params;
        const format = request.query.format ?? "html";
        const fulfilled = request.query.fulfilled;
        const tweet = await this.degovService.findChainWithSmartProposalId(
          fastify,
          {
            chainId: chain,
            proposalId: id,
            fulfilled,
          }
        );
        if (!tweet) {
          return Resp.err(`tweet not found for chain ${chain} and id ${id}`);
        }

        const dao = await this.daoService.dao(fastify, {
          daocode: tweet.daocode,
        });
        if (!dao) {
          return Resp.err(`dao not found for daocode ${tweet.daocode}`);
        }

        const twu = this.twitterAgent.currentUser({ xprofile: dao.xprofile });
        const renderTweet = {
          ...tweet,
          fulfilled_explain: JSON.parse(tweet.fulfilled_explain || "{}"),
          dao,
          twitter_user: twu,
        };

        console.log(renderTweet);
        if (format === "html") {
          return reply.view("view/proposal-voted.handlebars", {
            tweet: renderTweet,
          });
        }
        const outputTweet = {
          ...renderTweet,
          fulfilled_explain: {
            input: {
              pollOptions: renderTweet.fulfilled_explain?.input?.pollOptions,
            },
            output: renderTweet.fulfilled_explain?.output,
          },
        };
        return Resp.ok(outputTweet);
      }
    );
  }
}

const DegovSummaryRequestSchema = {
  schema: {
    body: {
      type: "object",
      properties: {
        id: { type: "string" },
        chain: { type: "number" },
        indexer: { type: "string" },
      },
      required: ["id", "chain", "indexer"],
    },
  },
};

const DegovVoteRequestSchema = {
  schema: {
    params: {
      type: "object",
      properties: {
        chain: { type: "number" },
        id: { type: "string" },
      },
      required: ["chain", "id"],
    },
    querystring: {
      type: "object",
      properties: {
        format: { type: "string" },
        fulfilled: { type: "number" },
      },
      required: [],
    },
  },
};
