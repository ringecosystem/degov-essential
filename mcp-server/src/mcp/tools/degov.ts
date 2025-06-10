import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { FastifyInstance } from "fastify";
import { Service } from "typedi";

@Service()
export class DegovTools {
  async regist(fastify: FastifyInstance, server: McpServer) {
    await this.registProposals(fastify, server);
  }

  private async registProposals(fastify: FastifyInstance, server: McpServer) {
    // server.tool("proposals", async (params) => {
    //   const { proposalId } = params;
    //   if (!proposalId) {
    //     return {
    //       content: [{ type: "text", text: "Proposal ID is required." }],
    //     };
    //   }
    //   // Here you would typically fetch the proposal data from a database or an API
    //   // For demonstration, we return a mock proposal
    //   const mockProposal = {
    //     id: proposalId,
    //     title: "Sample Proposal",
    //     description: "This is a sample proposal description.",
    //   };
    //   return {
    //     content: [
    //       { type: "text", text: `Proposal ID: ${mockProposal.id}` },
    //       { type: "text", text: `Title: ${mockProposal.title}` },
    //       { type: "text", text: `Description: ${mockProposal.description}` },
    //     ],
    //   };
    // });

    server.registerTool(
      "degov-new-proposal",
      {
        description: "New proposal created event",
        inputSchema: {},
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
