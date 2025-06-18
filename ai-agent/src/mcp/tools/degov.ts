import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { FastifyInstance } from "fastify";
import { Service } from "typedi";
import { z } from "zod";

@Service()
export class DegovTools {
  async regist(fastify: FastifyInstance, server: McpServer) {
    // await this.registProposals(fastify, server);
  }

  private async registProposals(fastify: FastifyInstance, server: McpServer) {
    server.registerTool(
      "degov-generate-proposal-tweet",
      {
        description: "Generates a tweet for a proposal.",
        inputSchema: {
          xprofile: z.string().describe("The profile to use.").optional(),

          daocode: z.string().describe("The DAO code to use."),
          proposal_id: z.string().describe("Proposal ID"),
        },
        outputSchema: {},
      },
      async () => {
        return {
          content: [
            { type: "text", text: "New proposal created successfully." },
          ],
        };
      }
    );
  }
}
