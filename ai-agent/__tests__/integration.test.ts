import { OpenrouterAgent } from "../src/internal/openrouter";
import { EnvReader } from "../src/integration/env-reader";
import { generateText } from "ai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
const twttr = require("@ambassify/twitter-text");

dotenv.config();

describe("AI Test", () => {
  it(
    "check generate tweet",
    async () => {
      const agent = new OpenrouterAgent();

      const aiProposalResp = await generateText({
        model: agent.openrouter(EnvReader.aiModel()),
        system: `You are a professional decentralized DAO proposal writer, helping users write very unique and detailed proposals`,
        prompt: `Please help me write a proposal, random topic`,
      });

      // Read the system prompt from the template file
      const systemPromptPath = path.join(
        __dirname,
        "../src/template/prompts/tweet-new-proposal.system.md"
      );
      const systemPrompt = fs.readFileSync(systemPromptPath, "utf-8");

      const rawData = {
        daoname: "Degov Demo DAO",
        carry: ["#DeGov", "@DeGovRoasted"],
        url: "https://demo.degov.ai/proposal/0x1ff71b17bc186d83d2abd2fc3854a71fb0ef43e53adb23cd5b13de57e4f8aabd",
        description: aiProposalResp.text,
        verified: true,
      };

      const userPrompt = `
${JSON.stringify(rawData)}

Generate a poll tweet use above data
    `;
      console.log(userPrompt);
      const aiTweetResp = await generateText({
        model: agent.openrouter(EnvReader.aiModel()),
        system: systemPrompt,
        prompt: userPrompt,
      });
      const parsedTweet = twttr.parseTweet(aiTweetResp.text);

      console.log(aiTweetResp.text);
      console.log(parsedTweet);
    },
    1000 * 60
  );
});
