import { FastifyInstance } from "fastify";
import { Service } from "typedi";

@Service()
export class ProposalStatusTask {
  async start(fastify: FastifyInstance) {

  }
}
