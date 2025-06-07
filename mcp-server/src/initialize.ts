import { Service } from "typedi";
import { FastifyInstance } from "fastify";
import { TwitterService } from "./services/twitter";

@Service()
export class DegovMcpServerInitializer {
  constructor(private readonly twitterService: TwitterService) {}

  async init(fastify: FastifyInstance) {
    try {
      await this.initTwitterApi(fastify);
    } catch (error) {
      console.log(error);
      throw new Error(
        `Failed to initialize: ${error ? (error as Error).message : error}`
      );
    }
  }

  private async initTwitterApi(fastify: FastifyInstance) {
    await this.twitterService.loadAuthorization(fastify);
  }
}
