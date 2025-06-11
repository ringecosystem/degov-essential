import { FastifyInstance } from "fastify";
import { Service } from "typedi";
import { Resp } from "../types";
import { DaoService } from "../services/dao";

@Service()
export class DegovRouter {
  constructor(private readonly daoService: DaoService) {}

  async regist(fastify: FastifyInstance) {
    fastify.get("/degov/daos", async (request, reply) => {
      const daos = await this.daoService.daos(fastify);
      return Resp.ok(daos);
    });

    fastify.get("/degov/next-proposals", async (request, reply) => {
      const events = await this.daoService.nextNewProposals(fastify);
      return Resp.ok(events);
    });
  }
}
