import { FastifyInstance } from "fastify";

export async function getBuiltInPrompt(
  fastify: FastifyInstance,
  templateFile: string
): Promise<string | undefined> {
  const content = await fastify.view(templateFile, {
    text: "text",
  });
  return content;
}
