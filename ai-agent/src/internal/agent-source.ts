import { Service } from "typedi";
import { DegovConfig, DegovDaoConfig, RawDegovDaoConfig } from "../types";
import * as yaml from "yaml";
import { FastifyInstance } from "fastify";
import { EnvReader } from "../integration/env-reader";
import * as fs from "fs/promises";

@Service()
export class DegovAgentSource {
  private daos: DegovDaoConfig[] = [];

  async init(fastify: FastifyInstance): Promise<void> {
    const agentConfigPath = EnvReader.envRequired("DEGOV_AGENT_CONFIG_PATH");

    const configRawYml = await fs.readFile(agentConfigPath, "utf8");
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
      const degovConfig = await this.fetchDegovConfig(fastify, rawDao.config);
      if (!degovConfig) {
        fastify.log.warn(`Failed to fetch degov config from ${rawDao.config}`);
        continue;
      }
      const daoConfig: DegovDaoConfig = {
        code: degovConfig.code,
        xprofile: rawDao.xprofile,
        carry: rawDao.carry,
        config: degovConfig,
        extend: rawDao.config,
      };
      this.daos.push(daoConfig);
    }

    fastify.log.info(
      `Successfully loaded ${this.daos.length} DAO configurations`
    );
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
