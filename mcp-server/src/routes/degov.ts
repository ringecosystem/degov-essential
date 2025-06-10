import { FastifyInstance } from "fastify";
import { Service } from "typedi";
import { ConfigReader } from "../integration/config-reader";
import { Resp } from "../types";

@Service()
export class DegovRouter {
  async regist(fastify: FastifyInstance) {
    fastify.get("/degov/daos", async (request, reply) => {
      const daos = ConfigReader.degovDaos();
      return Resp.ok(daos);
    });
  }
}
