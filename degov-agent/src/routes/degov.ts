import { FastifyInstance, FastifyRequest } from "fastify";
import { Service } from "typedi";
import { DegovSummaryForm, Resp } from "../types";
import { DaoService } from "../services/dao";
import { DegovService } from "../services/degov";

@Service()
export class DegovRouter {
  constructor(
    private readonly daoService: DaoService,
    private readonly degovService: DegovService
  ) {}

  async regist(fastify: FastifyInstance) {
    fastify.get("/degov/daos", async (request, reply) => {
      const daos = await this.daoService.daos(fastify);
      return Resp.ok(daos);
    });

    fastify.get(
      "/degov/summary",
      DegovSummaryRequestSchema,
      async (request: FastifyRequest<{ Body: DegovSummaryForm }>, reply) => {
        const body = request.body;
        const summary = await this.degovService.generateProposalSummary(
          fastify,
          body
        );
        return Resp.ok(summary);
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
        indexer: { type: "string" },
      },
      required: ["id", "indexer"],
    },
  },
};
