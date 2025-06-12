import { FastifyInstance } from "fastify";
// import { readFileSync } from "fs";
// import { join } from "path";

export async function getBuiltInPrompt(
  fastify: FastifyInstance,
  name: string
): Promise<string | undefined> {
  const content = await fastify.view("prompts/tweet-new-proposal.system.md", {
    text: "text",
  });
  return content;
}
