import { OpenrouterAgent } from "../src/internal/openrouter";
import { EnvReader } from "../src/integration/env-reader";
import { generateText } from "ai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
const twttr = require("@ambassify/twitter-text");

dotenv.config();

describe("AI Test", () => {
  //   it(
  //     "check generate tweet",
  //     async () => {
  //       const agent = new OpenrouterAgent();

  //       const aiProposalResp = await generateText({
  //         model: agent.openrouter(EnvReader.aiModel()),
  //         system: `You are a professional decentralized DAO proposal writer, helping users write very unique and detailed proposals`,
  //         prompt: `Please help me write a proposal, random topic`,
  //       });

  //       // Read the system prompt from the template file
  //       const systemPromptPath = path.join(
  //         __dirname,
  //         "../src/template/prompts/tweet-new-proposal.system.md"
  //       );
  //       const systemPrompt = fs.readFileSync(systemPromptPath, "utf-8");

  //       const rawData = {
  //         daoname: "Degov Demo DAO",
  //         carry: ["#DeGov", "@DeGovRoasted"],
  //         url: "https://demo.degov.ai/proposal/0x1ff71b17bc186d83d2abd2fc3854a71fb0ef43e53adb23cd5b13de57e4f8aabd",
  //         description: aiProposalResp.text,
  //         verified: true,
  //       };

  //       const userPrompt = `
  // ${JSON.stringify(rawData)}

  // Generate a poll tweet use above data
  //       `;
  //       console.log(userPrompt);
  //       const aiTweetResp = await generateText({
  //         model: agent.openrouter(EnvReader.aiModel()),
  //         system: systemPrompt,
  //         prompt: userPrompt,
  //       });
  //       const parsedTweet = twttr.parseTweet(aiTweetResp.text);

  //       console.log(aiTweetResp.text);
  //       console.log(parsedTweet);
  //     },
  //     1000 * 60
  //   );

  it(
    "check vote template",
    async () => {
      const agent = new OpenrouterAgent();

      const aiCommentResp = await generateText({
        model: agent.openrouter(EnvReader.aiModel()),
        system: `You are a commentator. You can imagine a community proposal and make comments. You can support or oppose it.`,
        prompt: `You provide a comment related to the DAO proposal`,
      });

      const systemPromptPath = path.join(
        __dirname,
        "../src/template/prompts/tweet-new-vote-cast.system.md"
      );
      const systemPrompt = fs.readFileSync(systemPromptPath, "utf-8");

      const rawData = {
        voterAddressLink:
          "https://demo.degov.ai/delegate/0xadd3cbe0f427be1cb318b299331d3b13d2b585b6",
        transactionLink:
          "https://explorer.darwinia.network/tx/0x8dca4a354433070c57929b4b7acf20a0fdedbfa1e41dbdfe0ba61ea0d577ba75",
        proposalLink:
          "https://demo.degov.ai/proposal/0x5cf60cd69cfcdbb287cf483ae4270dd4622d64153ecd0c477fdf68092c0bb0b0#0xadd3cbe",
        choice: "For",
        reason: aiCommentResp.text,
        verified: true,
      };

      const userPrompt = `
${JSON.stringify(rawData)}

Generate a tweet use above data
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
