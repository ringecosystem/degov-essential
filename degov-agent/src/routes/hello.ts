import { FastifyInstance } from "fastify";
import { Service } from "typedi";

@Service()
export class HelloRouter {
  async regist(fastify: FastifyInstance) {
    fastify.get("/", async (_request, _reply) => {
      return "hello";
    });
  }
}
