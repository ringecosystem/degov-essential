import { Service } from "typedi";
import { FastifyInstance } from "fastify";
import { TwitterService } from "./services/twitter";
import { EnvReader } from "./integration/env-reader";

@Service()
export class DegovMcpServerInitializer {
  constructor(private readonly twitterService: TwitterService) {}

  async init(fastify: FastifyInstance) {
    await this.ensureEnv();
    await this.initTwitterApi(fastify);
  }

  private async ensureEnv() {
    EnvReader.env('OPENROUTER_API_KEY');
  }

  private async initTwitterApi(fastify: FastifyInstance) {
    await this.twitterService.loadAuthorization(fastify);
  }
}
