import { Service } from "typedi";
import { DegovDaoConfig } from "../types";
import * as yaml from "yaml";
import { FastifyInstance } from "fastify";

@Service()
export class DegovAgentSource {
  private daos: DegovDaoConfig[] = [];

  async refresh(fastify: FastifyInstance): Promise<void> {
    try {
      const resp = await fastify.axios.get(
        "https://raw.githubusercontent.com/ringecosystem/degov-essential/refs/heads/improve-code/config/agent/config.yml"
      );
      const configRawYml = resp.data;
      const parsedConfig: DegovAgentConfig = yaml.parse(configRawYml);

      if (!Array.isArray(parsedConfig)) {
        throw new Error(
          "Invalid config format: expected array of DAO configurations"
        );
      }

      this.daos = parsedConfig.daos;

      fastify.log.info(
        `Successfully refreshed ${this.daos.length} DAO configurations`
      );
    } catch (error) {
      fastify.log.error(
        `Failed to refresh DAO configurations: ${
          error instanceof Error ? error.message : error
        }`
      );

      throw error;
    }
  }

  getDaos(): DegovDaoConfig[] {
    return this.daos;
  }

  getDao(code: string): DegovDaoConfig | undefined {
    return this.daos.find((dao) => dao.code === code);
  }
}

interface DegovAgentConfig {
  daos: DegovDaoConfig[];
}
