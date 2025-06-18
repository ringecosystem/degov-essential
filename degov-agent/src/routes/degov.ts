import { FastifyInstance, FastifyRequest } from "fastify";
import { Service } from "typedi";
import { DegovSummaryForm, Resp } from "../types";
import { DaoService } from "../services/dao";
import { DegovService } from "../services/degov";
import { GovernorContract } from "../internal/governor";

@Service()
export class DegovRouter {
  constructor(
    private readonly daoService: DaoService,
    private readonly degovService: DegovService,
    private readonly governorContract: GovernorContract
  ) {}

  async regist(fastify: FastifyInstance) {
    fastify.get("/degov/daos", async (_request, _reply) => {
      const daos = await this.daoService.daos(fastify);
      return Resp.ok(daos);
    });

    fastify.get("/degov/bot-address", async (_request, _reply) => {
      const address = this.governorContract.botAccoutAddress();
      return Resp.ok({ address });
    });

    fastify.post(
      "/degov/summary/proposal",
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
