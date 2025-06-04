import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Service } from "typedi";

@Service()
export class DegovMcpServer {
  constructor() {}

  async create() {
    const mcpServer = new McpServer({
      name: "degov-mcp",
      version: "0.0.1",
      capabilities: {
        resources: {},
        tools: {},
      },
    });
    await this.registerTools(mcpServer);
    return mcpServer.server;
  }

  private async registerTools(server: McpServer) {
    server.tool("greet", () => {
      return {
        content: [{ type: "text", text: "Hello, world!" }],
      };
    });
  }
}
