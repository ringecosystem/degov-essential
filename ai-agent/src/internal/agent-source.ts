import { Service } from "typedi";
import { DegovConfig, DegovDaoConfig, RawDegovDaoConfig } from "../types";
import * as yaml from "yaml";
import { FastifyInstance } from "fastify";

@Service()
export class DegovAgentSource {
  private daos: DegovDaoConfig[] = [];

  async refresh(fastify: FastifyInstance): Promise<void> {
    try {
      const resp = await fastify.axios.get(
        "https://raw.githubusercontent.com/ringecosystem/degov-essential/refs/heads/fix-timelock/config/agent/config.yml"
      );
      const configRawYml = resp.data;
      const parsedConfig: RawDegovAgentConfig = yaml.parse(configRawYml);

      if (!parsedConfig || !parsedConfig.daos) {
        throw new Error("Invalid config format: missing 'daos' property");
      }

      if (!Array.isArray(parsedConfig.daos)) {
        throw new Error(
          "Invalid config format: expected array of DAO configurations"
        );
      }

      for (const rawDao of parsedConfig.daos) {
        const degovConfig = await this.fetchDegovConfig(fastify, rawDao.extend);
        if (!degovConfig) {
          fastify.log.warn(
            `Failed to fetch degov config from ${rawDao.extend}`
          );
          continue;
        }
        const daoConfig: DegovDaoConfig = {
          code: rawDao.code,
          xprofile: rawDao.xprofile,
          carry: rawDao.carry,
          config: degovConfig,
        };
        this.daos.push(daoConfig);
      }

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

  private async fetchDegovConfig(
    fastify: FastifyInstance,
    configLink: string
  ): Promise<DegovConfig | undefined> {
    const cacheKey = `degov-config-${configLink}`;
    const cachedConfig = await fastify.cache.get(cacheKey);
    if (cachedConfig) {
      return cachedConfig as DegovConfig;
    }
    try {
      const response = await fastify.axios.get(configLink);
      if (!response.data) {
        return;
      }
      const output = yaml.parse(response.data) as DegovConfig;
      await fastify.cache.set(cacheKey, output, 60 * 60); // Cache for 1 hour
      return output;
    } catch (error) {
      fastify.log.error(
        `Failed to fetch degov config from ${configLink}: ${error}`
      );
      return;
    }
  }

  getDaos(): DegovDaoConfig[] {
    return this.daos;
  }

  getDao(code: string): DegovDaoConfig | undefined {
    return this.daos.find((dao) => dao.code === code);
  }
}

interface RawDegovAgentConfig {
  daos: RawDegovDaoConfig[];
}
