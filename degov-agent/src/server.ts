import { Service } from "typedi";
import Fastify, { FastifyInstance } from "fastify";
// import { Sessions, streamableHttp, fastifyMCPSSE } from "fastify-mcp";
// import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { DEFINED_LOGGER_RULE } from "./integration/logger";
import { DegovHelpers } from "./helpers";
import { Resp, RuntimeProfile } from "./types";
import { DegovMcpServerInitializer } from "./initialize";
import { HelloRouter } from "./routes/hello";
import { TwitterRouter } from "./routes/twitter";
import fastifyCache, {
  defaultStorageAdapter,
} from "@specter-labs/fastify-cache";
import fastifyAxios from "fastify-axios";
import fastifyView from "@fastify/view";
import fastifyPrisma from "@joggr/fastify-prisma";
import { SnowflakeId } from "@akashrajpurohit/snowflake-id";
import { PrismaClient } from "./generated/prisma";

import path from "path";
import { DegovRouter } from "./routes/degov";
import {
  DegovProposalNewTask,
  DegovProposalVoteTask,
  DegovProposalStatusTask,
  DegovTweetSyncTask,
  DegovProposalFulfillTask,
} from "./tasks";
import { fastifySchedule } from "@fastify/schedule";

@Service()
export class DegovMcpHttpServer {
  constructor(
    private readonly initializer: DegovMcpServerInitializer,
    // private readonly mcpServer: DegovMcpServer,
    private readonly helloRouter: HelloRouter,
    private readonly twitterRouter: TwitterRouter,
    private readonly degovRouter: DegovRouter,
    private readonly degovProposalNewTask: DegovProposalNewTask,
    private readonly degovProposalVoteTask: DegovProposalVoteTask,
    private readonly degovProposalFulfillTask: DegovProposalFulfillTask,
    private readonly degovTweetSyncTask: DegovTweetSyncTask,
    private readonly degovProposalStatusTask: DegovProposalStatusTask
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
      await this.task(fastify);
      // await this.mcp(fastify);

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
    fastify.register(fastifyAxios);
    await fastify.register(fastifyPrisma, {
      client: new PrismaClient(),
    });
    await fastify.register(fastifyCache, {
      storageAdapter: defaultStorageAdapter,
      ttl: 60 * 5, // 5 minutes
    });
    await fastify.register(fastifySchedule);

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
      root: path.join(__dirname, "template"),
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
    await this.helloRouter.regist(fastify);
    await this.twitterRouter.regist(fastify);
    await this.degovRouter.regist(fastify);
  }

  private async task(fastify: FastifyInstance) {
    await this.degovProposalNewTask.start(fastify);
    await this.degovProposalVoteTask.start(fastify);
    await this.degovProposalFulfillTask.start(fastify);
    await this.degovTweetSyncTask.start(fastify);
    await this.degovProposalStatusTask.start(fastify);
  }

  // private async mcp(fastify: FastifyInstance) {
  //   const sessions = new Sessions<StreamableHTTPServerTransport>();

  //   sessions.on("connected", (sessionId) => {
  //     fastify.log.info(`Session ${sessionId} connected`);
  //   });

  //   sessions.on("terminated", (sessionId) => {
  //     fastify.log.info(`Session ${sessionId} terminated`);
  //   });

  //   const transportType = EnvReader.env("MCP_TRANSPORT_TYPE", {
  //     defaultValue: "sse",
  //   }).toLowerCase();

  //   switch (transportType) {
  //     case "sse":
  //       fastify.register(fastifyMCPSSE, {
  //         server: await this.mcpServer.create(fastify),
  //       });
  //       break;
  //     case "streamable_http":
  //       fastify.register(streamableHttp, {
  //         stateful: true,
  //         mcpEndpoint: "/mcp",
  //         sessions,
  //         createServer: async () => await this.mcpServer.create(fastify),
  //       });
  //       break;
  //   }
  // }
}
