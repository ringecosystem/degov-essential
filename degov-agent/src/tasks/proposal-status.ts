import { FastifyInstance } from "fastify";
import { Service } from "typedi";

@Service()
export class DegovProposalStatusTask {
  async start(fastify: FastifyInstance) {

  }
}
