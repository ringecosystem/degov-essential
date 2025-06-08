import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Service } from "typedi";
import { TwitterTools } from "./tools/x";

@Service()
export class DegovMcpServer {
  constructor(private readonly twitterTools: TwitterTools) {}

  async create() {
    const mcpServer = new McpServer({
      name: "degov-mcp",
      version: "0.0.1",
      capabilities: {
        resources: {},
        tools: {},
      },
    });

    await this.registTools(mcpServer);
    return mcpServer.server;
  }

  private async registTools(server: McpServer) {
    await this.twitterTools.regist(server);

    server.tool("greet", () => {
      return {
        content: [{ type: "text", text: "Hello, world!" }],
      };
    });
  }
}
