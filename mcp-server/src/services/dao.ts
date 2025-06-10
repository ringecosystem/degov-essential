import { Service } from "typedi";
import { DegovConfig, DegovMcpDao } from "../types";
import { ConfigReader } from "../integration/config-reader";
import { FastifyInstance } from "fastify";
import yaml from "yaml";

@Service()
export class DaoService {
  async daos(fastify: FastifyInstance): Promise<DegovMcpDao[]> {
    const daos = ConfigReader.degovDaos();
    const result: DegovMcpDao[] = [];
    for (const daoc of daos) {
      const { name, xprofile, links } = daoc;
      const configLink = links.config;
      const degovConfig = await this.fetchDegovConfig(fastify, configLink);
      const dmd: DegovMcpDao = {
        name,
        xprofile,
        links,
        config: degovConfig,
        lastProcessedBlock: -1,
      };
      result.push(dmd);
    }
    return result;
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
}
