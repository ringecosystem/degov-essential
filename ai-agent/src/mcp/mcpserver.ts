import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Service } from "typedi";
import { TwitterTools } from "./tools/x";
import { FastifyInstance } from "fastify";
import { DegovTools } from "./tools/degov";

@Service()
export class DegovMcpServer {
  constructor(
    private readonly twitterTools: TwitterTools,
    private readonly degovTools: DegovTools
  ) {}

  async create(fastify: FastifyInstance) {
    const mcpServer = new McpServer({
      name: "degov-mcp",
      version: "0.0.1",
      capabilities: {
        resources: {},
        tools: {},
      },
    });
    await this.registTools(fastify, mcpServer);
    return mcpServer.server;
  }

  private async registTools(fastify: FastifyInstance, server: McpServer) {
    await this.twitterTools.regist(fastify, server);
    await this.degovTools.regist(fastify, server);

    // server.tool("greet", () => {
    //   return {
    //     content: [{ type: "text", text: "Hello, world!" }],
    //   };
    // });
  }
}
