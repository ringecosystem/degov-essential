import { Service } from "typedi";
import Fastify, { FastifyInstance } from "fastify";
import { Sessions, streamableHttp, fastifyMCPSSE } from "fastify-mcp";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { DEFINED_LOGGER_RULE } from "./integration/logger";
import { DegovHelpers } from "./helpers";
import { RuntimeProfile } from "./types";
import { DegovMcpServer } from "./mcp/mcpserver";
import { DegovMcpServerInitializer } from "./initialize";
import { HelloRouter } from "./routes/hello";
import { TwitterRouter } from "./routes/twitter";
// import fastifyCaching from "@fastify/caching";
import fastifyCache, {
  defaultStorageAdapter,
} from "@specter-labs/fastify-cache";

@Service()
export class DegovMcpHttpServer {
  constructor(
    private readonly initializer: DegovMcpServerInitializer,
    private readonly mcpServer: DegovMcpServer,
    private readonly helloRouter: HelloRouter,
    private readonly twitterRouter: TwitterRouter
  ) {}

  async listen(options: { host: string; port: number }) {
    const profile: RuntimeProfile = DegovHelpers.runtimeProfile();
    const fastify = Fastify({
      logger: DEFINED_LOGGER_RULE[profile] ?? true,
      disableRequestLogging: profile == RuntimeProfile.Production,
      ignoreTrailingSlash: true,
      ignoreDuplicateSlashes: true,
    });

    await this.initializer.init(fastify);
    try {
      await this.richs(fastify);
      await this.routes(fastify);
      await this.mcp(fastify);

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
    // const Cache = require("cache");
    // fastify.register(fastifyCaching, { cache: new Cache() });

    fastify.register(fastifyCache, {
      storageAdapter: defaultStorageAdapter,
      ttl: 60 * 5, // 5 minutes
    });

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

  private async routes(fastify: FastifyInstance) {
    this.helloRouter.regist(fastify);
    this.twitterRouter.regist(fastify);
  }

  private async mcp(fastify: FastifyInstance) {
    const sessions = new Sessions<StreamableHTTPServerTransport>();

    sessions.on("connected", (sessionId) => {
      fastify.log.info(`Session ${sessionId} connected`);
    });

    sessions.on("terminated", (sessionId) => {
      fastify.log.info(`Session ${sessionId} terminated`);
    });

    const transportType = (
      process.env.MCP_TRANSPORT_TYPE || "sse"
    ).toLowerCase();

    switch (transportType) {
      case "sse":
        fastify.register(fastifyMCPSSE, {
          server: await this.mcpServer.create(),
        });
        break;
      case "streamable_http":
        fastify.register(streamableHttp, {
          stateful: true,
          mcpEndpoint: "/mcp",
          sessions,
          createServer: this.mcpServer.create,
        });
        break;
    }
  }
}
