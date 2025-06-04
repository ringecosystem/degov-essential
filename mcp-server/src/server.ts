import { Service } from "typedi";
import { DegovHelpers } from "./helpers";
import { RuntimeProfile } from "./types";
import Fastify, { FastifyInstance } from "fastify";
import { DEFINED_LOGGER_RULE } from "./integration/logger";

@Service()
export class DegovMcpServer {
  async listen(options: { host: string; port: number }) {
    const profile: RuntimeProfile = DegovHelpers.runtimeProfile();
    const fastify = Fastify({
      logger: DEFINED_LOGGER_RULE[profile] ?? true,
      disableRequestLogging: profile == RuntimeProfile.Production,
      ignoreTrailingSlash: true,
      ignoreDuplicateSlashes: true,
    });
    try {
      await this.richs(fastify);
      await this.routes(fastify);

      await fastify.listen({ host: options.host, port: options.port });
      fastify.log.info(
        `Server is running at http://${options.host}:${options.port}`
      );
    } catch (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  }

  private async richs(fastify: FastifyInstance) {
    fastify.setReplySerializer(function (payload, _statusCode) {
      return JSON.stringify(payload, (_, v) => {
        if (typeof v === "bigint") {
          return v.toString();
        }
        if (v === null) {
          return undefined;
        }
        return v;
      });
    });
  }

  private async routes(fastify: FastifyInstance) {}
}
