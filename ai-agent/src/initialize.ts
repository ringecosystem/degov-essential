import { Service } from "typedi";
import { FastifyInstance } from "fastify";
import { TwitterService } from "./services/twitter";
import { EnvReader } from "./integration/env-reader";
import { DegovAgentSource } from "./internal/agent-source";
import { HbsRegister } from "./internal/hbs";

@Service()
export class DegovAiAgentInitializer {
  constructor(
    private readonly twitterService: TwitterService,
    private readonly degovAgentSource: DegovAgentSource
  ) {}

  async init(fastify: FastifyInstance) {
    await this.ensureEnv();
    await this.initTwitterApi(fastify);
    await this.degovAgentSource.init(fastify);
    HbsRegister.regist();
  }

  private async ensureEnv() {
    EnvReader.env("OPENROUTER_API_KEY");
    EnvReader.env("DEGOV_AGENT_PRIVATE_KEY");
    EnvReader.twitterEnv();
    EnvReader.aiModel();
  }

  private async initTwitterApi(fastify: FastifyInstance) {
    await this.twitterService.loadAuthorization(fastify);
  }
}
