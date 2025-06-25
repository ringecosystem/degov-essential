import { OpenrouterAgent } from "../src/internal/openrouter";
import { EnvReader } from "../src/integration/env-reader";
import { generateText, generateObject } from "ai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
const twttr = require("@ambassify/twitter-text");
import { AnalysisResultSchema } from "../src/types";

dotenv.config();

describe("AI Test", () => {
  // it(
  //   "check generate tweet",
  //   async () => {
  //     const agent = new OpenrouterAgent();

  //     const aiProposalResp = await generateText({
  //       model: agent.openrouter(EnvReader.aiModel()),
  //       system: `You are a professional decentralized DAO proposal writer, helping users write very unique and detailed proposals`,
  //       prompt: `Please help me write a proposal, random topic`,
  //     });

  //     // Read the system prompt from the template file
  //     const systemPromptPath = path.join(
  //       __dirname,
  //       "../src/template/prompts/tweet-new-proposal.system.md"
  //     );
  //     const systemPrompt = fs.readFileSync(systemPromptPath, "utf-8");

  //     const rawData = {
  //       daoname: "Degov Demo DAO",
  //       carry: ["#DeGov", "@DeGovRoasted"],
  //       url: "https://demo.degov.ai/proposal/0x1ff71b17bc186d83d2abd2fc3854a71fb0ef43e53adb23cd5b13de57e4f8aabd",
  //       description: aiProposalResp.text,
  //       verified: true,
  //     };

  //     const userPrompt = `${JSON.stringify(
  //       rawData
  //     )}\nGenerate a poll tweet use above data`;
  //     console.log(userPrompt);
  //     const aiTweetResp = await generateText({
  //       model: agent.openrouter(EnvReader.aiModel()),
  //       system: systemPrompt,
  //       prompt: userPrompt,
  //     });
  //     const parsedTweet = twttr.parseTweet(aiTweetResp.text);

  //     console.log(aiTweetResp.text);
  //     console.log(parsedTweet);
  //   },
  //   1000 * 60
  // );

  // it(
  //   "check vote template",
  //   async () => {
  //     const agent = new OpenrouterAgent();

  //     const aiCommentResp = await generateText({
  //       model: agent.openrouter(EnvReader.aiModel()),
  //       system: `You are a commentator. You can imagine a community proposal and make comments. You can support or oppose it.`,
  //       prompt: `You provide a comment related to the DAO proposal`,
  //     });

  //     const systemPromptPath = path.join(
  //       __dirname,
  //       "../src/template/prompts/tweet-new-vote-cast.system.md"
  //     );
  //     const systemPrompt = fs.readFileSync(systemPromptPath, "utf-8");

  //     const rawData = {
  //       voterAddressLink:
  //         "https://demo.degov.ai/delegate/0xadd3cbe0f427be1cb318b299331d3b13d2b585b6",
  //       transactionLink:
  //         "https://explorer.darwinia.network/tx/0x8dca4a354433070c57929b4b7acf20a0fdedbfa1e41dbdfe0ba61ea0d577ba75",
  //       proposalLink:
  //         "https://demo.degov.ai/proposal/0x5cf60cd69cfcdbb287cf483ae4270dd4622d64153ecd0c477fdf68092c0bb0b0#0xadd3cbe",
  //       choice: "For",
  //       reason: aiCommentResp.text,
  //       verified: true,
  //     };

  //     const userPrompt = `${JSON.stringify(
  //       rawData
  //     )}\nGenerate a tweet use above data`;
  //     console.log(userPrompt);
  //     const aiTweetResp = await generateText({
  //       model: agent.openrouter(EnvReader.aiModel()),
  //       system: systemPrompt,
  //       prompt: userPrompt,
  //     });
  //     const parsedTweet = twttr.parseTweet(aiTweetResp.text);

  //     console.log(aiTweetResp.text);
  //     console.log(parsedTweet);
  //   },
  //   1000 * 60
  // );

  //   it(
  //     "check vote report",
  //     async () => {
  //       const agent = new OpenrouterAgent();
  //       const userPrompt = `
  // **Tweet Poll:**
  // [{"label":"For","votes":2,"position":1},{"label":"Against","votes":1,"position":2},{"label":"Abstain","votes":0,"position":3}]

  // **Tweet replies:**
  // [{"text":"@ai_degov @ringecosystem This introduces a more complex and unpredictable system to solve an existing problem. Simpler solutions might exist to amplify community voice, such as improving the voting mechanism itself rather than adding a technical black box.","like_count":0,"retweet_count":0,"reply_count":0,"ctime":"2025-06-24T10:05:15.566Z"},{"text":"@ai_degov @ringecosystem Forum discussions need time to develop and be analyzed by the NLP, which could slow down governance response times. For urgent proposals requiring quick decisions, this analysis model may fail to provide timely input.","like_count":0,"retweet_count":0,"reply_count":0,"ctime":"2025-06-24T10:05:15.566Z"},{"text":"@ai_degov @ringecosystem Compared to Twitter, which is vulnerable to bots and Sybil attacks, the account system and long-form discussion format of Discourse naturally raise the bar for manipulation, helping the Agent receive more authentic community signals.","like_count":0,"retweet_count":0,"reply_count":0,"ctime":"2025-06-24T10:05:15.566Z"},{"text":"@ai_degov @ringecosystem On-chain votes show what, while Twitter comments are emotional. Discourse analysis captures the why—the nuanced insights and key arguments behind a position, providing richer qualitative data for decisions.","like_count":0,"retweet_count":0,"reply_count":0,"ctime":"2025-06-24T10:05:15.566Z"}]

  // **On-Chain Vote Casts:**
  // [{"support":"For","reason":"This proposal is a critical step for evolving the DeGov Agent from purely quantitative governance to a mature model that combines both quantitative and qualitative inputs. The necessity and forward-thinking nature of this upgrade far outweigh the potential risks.\n\nThe current framework is fundamentally flawed. Twitter data, while broad, is inherently shallow and emotional, making it unsuitable for deep debate. Meanwhile, the \"one-token, one-vote\" principle is effectively a \"one-dollar, one-vote\" plutocracy. This allows whales to dominate decisions while silencing the voices of knowledgeable experts, developers, and long-term contributors who may hold fewer tokens.\n\nIntroducing Discourse analysis is the precise remedy. As an official venue for structured, long-form deliberation, it captures the intellectual capital of the community. It allows members to present complete logical arguments, data, and impact analyses. By assigning significant weight to these discussions, we directly reward members who invest their time and intellect, fostering a healthier, more constructive governance culture. This ultimately leads to more holistic, balanced, and far-sighted decisions, enhancing the resilience of the entire ecosystem.","weight":"340000000000000000000","blockTimestamp":"2025-06-24T09:58:12.000Z"},{"support":"Against","reason":"The core issue is the \"black box\" nature of the NLP model. The choice of model, its training data, and its update mechanisms can all become new points of centralized control. A biased NLP would systematically distort community intent in a way that is far harder to detect and correct than a whale's public vote. We would be shifting a portion of governance trust from code and token holders to opaque algorithm providers.","weight":"2000000000000000000","blockTimestamp":"2025-06-24T09:59:18.000Z"}]

  // Please analyze these data comprehensively and give final governance decision recommendations.
  //       `;

  //       const systemPromptPath = path.join(
  //         __dirname,
  //         "../src/template/prompts/tweet-fulfill-contract.system.md"
  //       );
  //       const systemPrompt = fs.readFileSync(systemPromptPath, "utf-8");

  //       const aiResp = await generateObject({
  //         model: agent.openrouter(EnvReader.aiModel()),
  //         schema: AnalysisResultSchema,
  //         system: systemPrompt,
  //         prompt: userPrompt,
  //       });

  //       console.log(JSON.stringify(aiResp.object, null, 2));
  //     },
  //     1000 * 60
  //   );

  it(
    "check vote report",
    async () => {
      const agent = new OpenrouterAgent();

      const systemPromptPath = path.join(
        __dirname,
        "../src/template/prompts/proposal-summary.system.md"
      );
      const systemPrompt = fs.readFileSync(systemPromptPath, "utf-8");

      const userPrompt = `
      Description
      Proposal Summary
      This proposal suggests a test of the deGov governance system by voting on whether to update the deGov token's information (e.g., tokenomics, project updates, news) across various social media platforms. This test aims to gauge community engagement and the efficiency of the governance process.

      Background
      Maintaining accurate and up-to-date information about the deGov token is crucial for attracting new users, retaining existing holders, and fostering transparency. Social media platforms serve as key channels for disseminating this information. This proposal seeks to utilize the deGov governance system to decide on a coordinated update of token information across these platforms.

      Proposal Details
      The proposal suggests the following steps:

      Identify Key Social Platforms: Determine the primary social media platforms where deGov token information is shared (e.g., Twitter, Telegram, Discord, Medium).

      Prepare Updated Information: Compile a comprehensive document containing the latest deGov token information, including tokenomics, recent project updates, team updates and relevant news.

      Governance Vote: Present the updated information and a plan for disseminating it across the identified social media platforms to the deGov governance system for a vote.

      Implementation: If the proposal passes, a designated team or individual will be responsible for updating the deGov token information on the selected social media platforms within a specified timeframe.

      Post-Update Monitoring: Monitor social media channels for engagement and feedback following the information update.

      Expected Impact
      Increased Awareness: Updating token information can increase awareness of the deGov token and its ecosystem.

      Improved Transparency: Providing accurate and up-to-date information enhances transparency and builds trust within the community.

      Enhanced Community Engagement: A successful governance vote and subsequent information update can foster a sense of ownership and engagement among deGov token holders.

      Test of Governance System: This proposal serves as a practical test of the deGov governance system, providing valuable insights into its effectiveness and potential areas for improvement.

      Voting Options
      Yes: Approve the proposal to update deGov token information on social media platforms.

      No: Reject the proposal to update deGov token information on social media platforms.

      ---
      Generate a comprehensive summary of the proposal based on the description provided.
    `;
      console.log(userPrompt);
      const aiSummaryResp = await generateText({
        model: agent.openrouter(EnvReader.aiModel()),
        system: systemPrompt,
        prompt: userPrompt,
      });
      console.log(aiSummaryResp.text);
    },
    1000 * 60
  );
});
