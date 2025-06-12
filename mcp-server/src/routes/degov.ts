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
  }
}
