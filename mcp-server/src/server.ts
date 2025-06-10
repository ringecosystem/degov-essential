import { Service } from "typedi";
import Fastify, { FastifyInstance } from "fastify";
import { Sessions, streamableHttp, fastifyMCPSSE } from "fastify-mcp";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { DEFINED_LOGGER_RULE } from "./integration/logger";
import { DegovHelpers } from "./helpers";
import { Resp, RuntimeProfile } from "./types";
import { DegovMcpServer } from "./mcp/mcpserver";
import { DegovMcpServerInitializer } from "./initialize";
import { HelloRouter } from "./routes/hello";
import { TwitterRouter } from "./routes/twitter";
import fastifyCache, {
  defaultStorageAdapter,
} from "@specter-labs/fastify-cache";
import fastifyView from "@fastify/view";
import fastifyPrisma from "@joggr/fastify-prisma";
import { SnowflakeId } from "@akashrajpurohit/snowflake-id";
import { PrismaClient } from "./generated/prisma";

import path from "path";
import { DegovRouter } from "./routes/degov";

@Service()
export class DegovMcpHttpServer {
  constructor(
    private readonly initializer: DegovMcpServerInitializer,
    private readonly mcpServer: DegovMcpServer,
    private readonly helloRouter: HelloRouter,
    private readonly twitterRouter: TwitterRouter,
    private readonly degovRouter: DegovRouter
  ) {}

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

      await this.initializer.init(fastify);
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
    await fastify.register(fastifyPrisma, {
      client: new PrismaClient(),
    });
    await fastify.register(fastifyCache, {
      storageAdapter: defaultStorageAdapter,
      ttl: 60 * 5, // 5 minutes
    });

    const snowflake = SnowflakeId({
      workerId: 1,
    });
    fastify.decorate("snowflake", snowflake);

    fastify.setReplySerializer(function (payload, _statusCode) {
      return DegovHelpers.safeJsonStringify(payload);
    });

    // render
    fastify.register(fastifyView, {
      engine: {
        handlebars: require("handlebars"),
      },
      root: path.join(__dirname, "views"),
      // layout: "./templates/template",
      defaultContext: {
        __profile: DegovHelpers.runtimeProfile(),
      },
    });

    // error handler
    fastify.setErrorHandler((error, _request, reply) => {
      fastify.log.error(error);

      const profile: RuntimeProfile = DegovHelpers.runtimeProfile();
      const errorData = {
        data: error.validation || undefined,
        stack: profile != RuntimeProfile.Production ? error.stack : undefined,
      };

      let message = `[${error.code || "INTERNAL_ERROR"}]: ${error.message}`;

      if ("data" in error) {
        let dataDetail;
        if (typeof error.data === "object" && error.data !== null) {
          dataDetail = JSON.stringify(error.data, null, 2);
        } else {
          dataDetail = String(error.data);
        }
        message = `${message} -> ${dataDetail}`;
      }

      const resp = Resp.errWithData(message, errorData);
      reply.status(error.statusCode || 500).send(resp);
    });
  }

  private async routes(fastify: FastifyInstance) {
    this.helloRouter.regist(fastify);
    this.twitterRouter.regist(fastify);
    this.degovRouter.regist(fastify);
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
          server: await this.mcpServer.create(fastify),
        });
        break;
      case "streamable_http":
        fastify.register(streamableHttp, {
          stateful: true,
          mcpEndpoint: "/mcp",
          sessions,
          createServer: async () => await this.mcpServer.create(fastify),
        });
        break;
    }
  }
}
