import Fastify, { FastifyInstance } from "fastify";

import { Service } from "typedi";
import { DegovHelpers, DegovLink } from "../../src/helpers";
import {
  ClockMode,
  NewProposalEvent,
  ProposalState,
  RuntimeProfile,
  SimpleProposal,
} from "../../src/types";
import { DEFINED_LOGGER_RULE } from "../../src/integration/logger";
import { HbsRegister } from "../../src/internal/hbs";
import fastifyView from "@fastify/view";
import handlebars from "handlebars";
import path from "path";
import { SendTweetInput, SimpleTweetUser } from "../../src/internal/x-agent";
import { OpenrouterAgent } from "../../src/internal/openrouter";
import { DIVoteCast } from "../internal/graphql";
import { GenProposalStateChangedTweetInput } from "../internal/tweetgen";

@Service()
export class AgentTestSupport {
  private _fastify: FastifyInstance | undefined;

  constructor(public readonly openrouterAgent: OpenrouterAgent) {}

  async init() {
    const profile: RuntimeProfile = DegovHelpers.runtimeProfile();
    const fastify = Fastify({
      logger: DEFINED_LOGGER_RULE[profile] ?? true,
      disableRequestLogging: profile == RuntimeProfile.Production,
      ignoreTrailingSlash: true,
      ignoreDuplicateSlashes: true,
    });

    // render
    await fastify.register(fastifyView, {
      engine: {
        handlebars: handlebars,
      },
      root: path.join(__dirname, "../../src/template"),
      // layout: "./templates/template",
      defaultContext: {
        __profile: DegovHelpers.runtimeProfile(),
      },
    });
    HbsRegister.regist();

    await fastify.ready();

    this._fastify = fastify;
  }

  async close() {
    if (!this._fastify) {
      return;
    }
    await this._fastify.close();
  }

  fastify(): FastifyInstance {
    if (!this._fastify) {
      throw new Error("Fastify instance is not initialized");
    }
    return this._fastify;
  }

  verifiedXUser(): SimpleTweetUser {
    return {
      id: "0x1234567890abcdef",
      username: "verified_user",
      verified: true,
    };
  }

  unVerifiedXUser(): SimpleTweetUser {
    return {
      id: "0xabcdef1234567890",
      username: "unverified_user",
      verified: false,
    };
  }

  degovLink(): DegovLink {
    return new DegovLink({
      siteUrl: "https://gov.ringdao.com",
      // @ts-ignore
      chain: {
        explorers: ["https://explorer.darwinia.network"],
      },
    });
  }

  formatSendTweet(tweetInput: SendTweetInput): string {
    const lines: string[] = [];

    // Header
    lines.push("# 🐦 Tweet Input Details");
    lines.push("");

    // Basic Information
    lines.push("## 📋 Basic Information");
    lines.push(`**Profile**: \`${tweetInput.xprofile || "N/A"}\``);
    lines.push(`**DAO Code**: \`${tweetInput.daocode}\``);
    lines.push(`**Proposal ID**: \`${tweetInput.proposalId}\``);
    lines.push(`**Chain ID**: \`${tweetInput.chainId}\``);
    lines.push("");

    // Tweet Content
    lines.push("## 📝 Tweet Content");
    if (tweetInput.text) {
      lines.push("```");
      lines.push(tweetInput.text);
      lines.push("```");
    } else {
      lines.push("*No text content*");
    }
    lines.push("");

    // Poll Information (if exists)
    if (tweetInput.poll) {
      lines.push("## 🗳️ Poll Configuration");
      if (tweetInput.poll.options && tweetInput.poll.options.length > 0) {
        lines.push(`**Options** (${tweetInput.poll.options.length}):`);
        tweetInput.poll.options.forEach((option, index) => {
          lines.push(`  ${index + 1}. ${option}`);
        });
      }
      if (tweetInput.poll.duration_minutes) {
        lines.push(`**Duration**: ${tweetInput.poll.duration_minutes} minutes`);
      }
      lines.push("");
    }

    // Reply Information (if exists)
    if (tweetInput.reply) {
      lines.push("## 💬 Reply Configuration");
      if (tweetInput.reply.in_reply_to_tweet_id) {
        lines.push(
          `**Reply to Tweet ID**: \`${tweetInput.reply.in_reply_to_tweet_id}\``
        );
      }
      if (
        tweetInput.reply.exclude_reply_user_ids &&
        tweetInput.reply.exclude_reply_user_ids.length > 0
      ) {
        lines.push(
          `**Exclude Reply Users**: ${tweetInput.reply.exclude_reply_user_ids
            .map((id) => `\`${id}\``)
            .join(", ")}`
        );
      }
      lines.push("");
    }

    // Media Information (if exists)
    if (tweetInput.media) {
      lines.push("## 🖼️ Media Attachments");
      if (tweetInput.media.media_ids && tweetInput.media.media_ids.length > 0) {
        lines.push(
          `**Media IDs**: ${tweetInput.media.media_ids
            .map((id) => `\`${id}\``)
            .join(", ")}`
        );
      }
      if (
        tweetInput.media.tagged_user_ids &&
        tweetInput.media.tagged_user_ids.length > 0
      ) {
        lines.push(
          `**Tagged Users**: ${tweetInput.media.tagged_user_ids
            .map((id) => `\`${id}\``)
            .join(", ")}`
        );
      }
      lines.push("");
    }

    // Quote Tweet Information (if exists)
    if (tweetInput.quote_tweet_id) {
      lines.push("## 🔄 Quote Tweet");
      lines.push(`**Quote Tweet ID**: \`${tweetInput.quote_tweet_id}\``);
      lines.push("");
    }

    // Geographic Information (if exists)
    if (tweetInput.geo) {
      lines.push("## 📍 Geographic Information");
      if (tweetInput.geo.place_id) {
        lines.push(`**Place ID**: \`${tweetInput.geo.place_id}\``);
      }
      lines.push("");
    }

    // Additional Settings
    const additionalSettings: string[] = [];
    if (tweetInput.for_super_followers_only) {
      additionalSettings.push("🌟 For Super Followers Only");
    }
    if (tweetInput.reply_settings) {
      additionalSettings.push(
        `💬 Reply Settings: ${tweetInput.reply_settings}`
      );
    }

    if (additionalSettings.length > 0) {
      lines.push("## ⚙️ Additional Settings");
      additionalSettings.forEach((setting) => lines.push(`- ${setting}`));
      lines.push("");
    }

    // Footer with timestamp
    lines.push("---");
    lines.push(`*Generated at: ${new Date().toISOString()}*`);

    return lines.join("\n");
  }

  proposalEvent(): NewProposalEvent {
    return {
      xprofile: "OFFICIAL",
      daocode: "ring-dao",
      daoname: "RING DAO",
      carry: ["#Governance", "#DeFAI", "#DAO"],
      daox: "ringecosystem",
      clockMode: ClockMode.Timestamp,
      blockInterval: 6,
      proposal: SIMPLE_PROPOSAL,
    };
  }

  stateChangedEvents(
    degovLink: DegovLink
  ): GenProposalStateChangedTweetInput[] {
    const transactionHash =
      "0x31ba1c9ec4e6c1a12335c6da2d090846663c36c4964625f3bf5fa69cd144457f";
    return [
      {
        degovLink,
        proposalId: PROPOSAL.proposalId,
        state: ProposalState.Pending,
      },
      {
        degovLink,
        proposalId: PROPOSAL.proposalId,
        state: ProposalState.Active,
      },
      {
        degovLink,
        proposalId: PROPOSAL.proposalId,
        state: ProposalState.Canceled,
        transactionHash,
      },
      {
        degovLink,
        proposalId: PROPOSAL.proposalId,
        state: ProposalState.Defeated,
      },
      {
        degovLink,
        proposalId: PROPOSAL.proposalId,
        state: ProposalState.Succeeded,
      },
      {
        degovLink,
        proposalId: PROPOSAL.proposalId,
        state: ProposalState.Executed,
        transactionHash,
      },
      {
        degovLink,
        proposalId: PROPOSAL.proposalId,
        state: ProposalState.Expired,
      },
      {
        degovLink,
        proposalId: PROPOSAL.proposalId,
        state: ProposalState.Queued,
        transactionHash,
        eta: new Date(),
      },
    ];
  }

  voteEvents(): DIVoteCast[] {
    return [
      {
        id: "0007603550-5a786-000000",
        proposalId:
          "0x21fe4d7b110c6263187dce84bd95a9017a9b0aa88f4136d65090432527797942",
        reason: "Necessary funding for RingDAO Community Guild.",
        support: "1",
        transactionHash:
          "0x49d39963b7d1e5512faf49b227d123eb2e6f5d5c4d155cce48285975659d4f6c",
        voter: "0xebd9a48ed1128375eb4383ed4d53478b4fd85a8d",
        weight: "11362000000000000000000000",
        blockNumber: "7603550",
        blockTimestamp: "1752728466000",
      },
      {
        id: "0007604362-0178b-000000",
        proposalId:
          "0x21fe4d7b110c6263187dce84bd95a9017a9b0aa88f4136d65090432527797942",
        reason: "",
        support: "1",
        transactionHash:
          "0x42f5dbc3ecbb86b07944c3d0576569266f612682003600f4d5098f08d1243cb5",
        voter: "0x822e4e429adedd91c96a81db39401a1770b96a5b",
        weight: "10000000000000000000000",
        blockNumber: "7604362",
        blockTimestamp: "1752735480000",
      },
      {
        id: "0007607668-713e3-000000",
        proposalId:
          "0x21fe4d7b110c6263187dce84bd95a9017a9b0aa88f4136d65090432527797942",
        reason: "",
        support: "0",
        transactionHash:
          "0x47e06981d655dff98284bbaee9128e1eaa6cd7cc9ec9f784e8e7972e1401f594",
        voter: "0x74cafa4ef28da1410e1de6f431b009367945df66",
        weight: "41120000000000000000000000",
        blockNumber: "7607668",
        blockTimestamp: "1752764280000",
      },
      {
        id: "0007608399-7782b-000000",
        proposalId:
          "0x21fe4d7b110c6263187dce84bd95a9017a9b0aa88f4136d65090432527797942",
        reason: "",
        support: "1",
        transactionHash:
          "0x68ac7c459f62cf66da34ed84a5389ea585a0906e8db96b0754811472b106b238",
        voter: "0xbd5a5d450f452d5adb85dacd6d52aa10fef77148",
        weight: "114767954850635000000000",
        blockNumber: "7608399",
        blockTimestamp: "1752770640000",
      },
      // {
      //   id: "0007699351-b109a-000000",
      //   proposalId:
      //     "0x21fe4d7b110c6263187dce84bd95a9017a9b0aa88f4136d65090432527797942",
      //   reason:
      //     'The final decision is "For" based on unanimous on-chain support, despite zero participation in the X poll and limited comments. The confidence is medium due to concentrated voting power and lack of broad community engagement.',
      //   support: "1",
      //   transactionHash:
      //     "0xfdad251254e1b20e8dfcdc571ccb502a707f8c82ede4e105d1d7527185a4909d",
      //   voter: "0x22c7f83418cc6868651e8a46ef9000d9be8866e5",
      //   weight: "970141000000000000000000",
      //   blockNumber: "7699351",
      //   blockTimestamp: "1753333308000",
      // },
    ];
  }
}

// ------

const PROPOSAL = {
  proposalId:
    "0x21fe4d7b110c6263187dce84bd95a9017a9b0aa88f4136d65090432527797942",
  proposer: "0xebd9a48ed1128375eb4383ed4d53478b4fd85a8d",
  signatures: [""],
  targets: ["0x8683a0ed2badb1f3aabea6686d78649f0da774a0"],
  transactionHash:
    "0x29867fcfc92f21b174eeccf88245bd021dff1f512c6436c52f1909ca47664132",
  values: ["7881403000000000000000000"],
  voteEnd: "1753938000",
  voteStart: "1752728400",
  calldatas: ["0x"],
  description:
    '# RCG 2025 Q3 Budget Application\n\n<p>​<strong>Date</strong>: 16/07/2025</p><p><strong>Requested Amount</strong>: 7,881,403 RING</p><p><strong>Receiving Address</strong>: 0x8683A0ED2bAdb1F3AaBeA6686d78649F0Da774A0</p><h2>1. Applicant Identity</h2><p>The Darwinia Community DAO (DCDAO) is a decentralized, member-governed entity dedicated to supporting the Darwinia ecosystem through community engagement, marketing, development support, and transparent governance.</p><h2>2. About DCDAO</h2><p><strong>DCDAO Overview</strong>:</p><ul class="tight" data-tight="true"><li><p>A community self-organized workgroup (WG) aiming to contribute to the growth and development of the Darwinia community.</p></li><li><p>Focus areas:</p><ul class="tight" data-tight="true"><li><p><strong>Community Engagement and Support</strong>: Enhance communication, provide educational resources, and assist community members.</p></li><li><p><strong>Marketing and Promotion</strong>: Create awareness through social media, events, and collaborations.</p></li><li><p><strong>Development Support</strong>: Facilitate the creation of tools, applications, and infrastructure for Darwinia.</p></li><li><p><strong>Governance and Decision-Making</strong>: Encourage community participation and transparency.</p></li></ul></li></ul><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://snapshot.org/#/darwiniacommunitydao.eth/proposal/0x257aff1540719475411091706f7b200507fe9b9fe7397a8a4347fbc9d7234cb6">More information</a></p><h2>3. Budget Details (Q3 2025)</h2><p>The RingDao Community Guild Budget has been reduce significantly for Q3.  At this time we are supporting two Ambassadors with Saso focused more on KtonDAO and Degov, Laki focused on all of our communities and Jesse acting as Community Manager/Treasury Specialist.  We are working to engage the community and help answer questions.  The funds requested will be used for salaries, quiz games and if approved in the Community Manager Q3 proposal paying for Discord Server boosts for RingDAO Discord.</p><p>Temp Check\n<a target="_blank" rel="noopener noreferrer nofollow" href="https://github.com/orgs/ringecosystem/discussions/31">https://github.com/orgs/ringecosystem/discussions/31</a></p><p>Note: Any surplus carries over to the next quarter if not used up by DCDAO.</p><table style="min-width: 125px"><colgroup><col style="min-width: 25px"><col style="min-width: 25px"><col style="min-width: 25px"><col style="min-width: 25px"><col style="min-width: 25px"></colgroup><tbody><tr><th colspan="1" rowspan="1"><p>Program</p></th><th colspan="1" rowspan="1"><p>Monthly Requested Amount (USD)</p></th><th colspan="1" rowspan="1"><p>Quarterly Requested Amount (USD)</p></th><th colspan="1" rowspan="1"><p>Total (RING)</p></th><th colspan="1" rowspan="1"><p>RING Price</p></th></tr><tr><td colspan="1" rowspan="1"><p>Community Manager Proposal (Q3)</p></td><td colspan="1" rowspan="1"><p>2,800.00</p></td><td colspan="1" rowspan="1"><p>8,400.00</p></td><td colspan="1" rowspan="1"><p>7,881,403</p></td><td colspan="1" rowspan="1"><p>0.0010658</p></td></tr></tbody></table><p> </p><p>Budget Adjustments:</p><ul class="tight" data-tight="true"><li><p>Steering Committee Payment: Shut down in favor of community guidance.</p></li><li><p>Marketing and Branding Program: Shifted under different management and funding structure.</p></li><li><p>Community Manager Proposal: Reduced funding to $2800 per month. Detailed Q3 budget to be posted soon.</p></li></ul><p>These changes are  parts of DCDAO’s efforts to optimize operational costs in response to bear market pressures and ensure the longevity of the project.</p><h2>4. Recent Achievements</h2><h3>4.1 Community</h3><ul class="tight" data-tight="true"><li><p>Helped support the development and testing of Degov.ai.</p></li><li><p>Boosted community engagement with weekly quizzes (20-25+ participants), Twitter updates, monthly articles, and GitHub discussions.</p></li><li><p>Supported KtonDAO, RingDAO, Helix Discord, and kept community channels spam-free.</p></li></ul><h2>5. Governance and Constitution</h2><ul class="tight" data-tight="true"><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://snapshot.org/#/darwiniacommunitydao.eth/proposal/0xe767cfef64633039225d935daaa24f5050b7e3c267efa74c447a3a25a982d467">Transition To Tally</a></p></li><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://snapshot.org/#/darwiniacommunitydao.eth/proposal/0xd750140eccee3434f65feb156c985f6425ed884d56aa2a295c189d5e76fe9dc5">DCDAO Constitution</a></p></li><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://snapshot.org/#/darwiniacommunitydao.eth/proposal/0xf54f569ed893d5391b7b4dc716aa8b52bc99c2ac170c8beb43f98cb1b4ce7557">Super Majority Voting Requirement</a></p></li><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://snapshot.org/#/darwiniacommunitydao.eth/proposal/0xadf0533b8e283bbfacb61e69c83f6ca3b624d4de0c78a0a29883ebe6adc85bcb">Member Join Proposal</a></p></li><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://snapshot.org/#/darwiniacommunitydao.eth/proposal/0x2e17e91c48afaf8233e5b9fed3ea48cc3b572a7f36d895732619fd64d5fa5331">Steering Committee Proposal</a></p></li></ul><h2>6. Team</h2><p><strong>Managers</strong>:</p><ul class="tight" data-tight="true"><li><p>Community Manager: Jesse</p></li><li><p>Management, Maintenance, and Development: Furqan</p></li></ul><p><strong>Steering Committee</strong>:</p><ul class="tight" data-tight="true"><li><p>Denny</p></li><li><p>Aki</p></li><li><p>Furqan</p></li><li><p>Eve</p></li><li><p>Nada</p></li></ul><p><strong>Ambassadors</strong>:</p><ul class="tight" data-tight="true"><li><p>Laki</p></li><li><p>Saso</p></li></ul><h2>7. DCDAO Treasury</h2><p><strong>Treasury Addresses</strong>:</p><ul class="tight" data-tight="true"><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://etherscan.io/address/0x195741BC761B25A89fc7798087652f97f29B306a">Ethereum</a></p></li><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://arbiscan.io/address/0x0DF9F845D33a49e259A0A20FD814bcf7e9BA6048">Arbitrum</a></p></li><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://polygonscan.com/address/0x28760448c28617047BCB2a756e2442567c23ED81">Polygon</a></p></li><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://darwinia.subscan.io/address/0x8683A0ED2bAdb1F3AaBeA6686d78649F0Da774A0">Darwinia</a></p></li><li><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://optimistic.etherscan.io/address/0x26102b33bB985bdD6a46D50A692338F0881ff5Cf">Optimism</a></p></li></ul><p><em>Note</em>: Multisig accounts are used only for executing decisions made explicitly in proposals. They reserve the right to refuse execution if the proposal lacks clarity.</p>\n\n<signature>[""]</signature>',
  blockNumber: "7603539",
  blockTimestamp: "1752728400000",
  voters: [
    {
      refProposalId:
        "0x21fe4d7b110c6263187dce84bd95a9017a9b0aa88f4136d65090432527797942",
      support: 1,
      transactionHash:
        "0x49d39963b7d1e5512faf49b227d123eb2e6f5d5c4d155cce48285975659d4f6c",
      type: "vote-cast-without-params",
      voter: "0xebd9a48ed1128375eb4383ed4d53478b4fd85a8d",
      weight: "11362000000000000000000000",
      params: null,
      blockNumber: "7603550",
      blockTimestamp: "1752728466000",
    },
    {
      refProposalId:
        "0x21fe4d7b110c6263187dce84bd95a9017a9b0aa88f4136d65090432527797942",
      support: 1,
      transactionHash:
        "0x42f5dbc3ecbb86b07944c3d0576569266f612682003600f4d5098f08d1243cb5",
      type: "vote-cast-without-params",
      voter: "0x822e4e429adedd91c96a81db39401a1770b96a5b",
      weight: "10000000000000000000000",
      params: null,
      blockNumber: "7604362",
      blockTimestamp: "1752735480000",
    },
    {
      refProposalId:
        "0x21fe4d7b110c6263187dce84bd95a9017a9b0aa88f4136d65090432527797942",
      support: 1,
      transactionHash:
        "0x47e06981d655dff98284bbaee9128e1eaa6cd7cc9ec9f784e8e7972e1401f594",
      type: "vote-cast-without-params",
      voter: "0x74cafa4ef28da1410e1de6f431b009367945df66",
      weight: "41120000000000000000000000",
      params: null,
      blockNumber: "7607668",
      blockTimestamp: "1752764280000",
    },
    {
      refProposalId:
        "0x21fe4d7b110c6263187dce84bd95a9017a9b0aa88f4136d65090432527797942",
      support: 1,
      transactionHash:
        "0x68ac7c459f62cf66da34ed84a5389ea585a0906e8db96b0754811472b106b238",
      type: "vote-cast-without-params",
      voter: "0xbd5a5d450f452d5adb85dacd6d52aa10fef77148",
      weight: "114767954850635000000000",
      params: null,
      blockNumber: "7608399",
      blockTimestamp: "1752770640000",
    },
    {
      refProposalId:
        "0x21fe4d7b110c6263187dce84bd95a9017a9b0aa88f4136d65090432527797942",
      support: 1,
      transactionHash:
        "0xfdad251254e1b20e8dfcdc571ccb502a707f8c82ede4e105d1d7527185a4909d",
      type: "vote-cast-without-params",
      voter: "0x22c7f83418cc6868651e8a46ef9000d9be8866e5",
      weight: "970141000000000000000000",
      params: null,
      blockNumber: "7699351",
      blockTimestamp: "1753333308000",
    },
  ],
};

const SIMPLE_PROPOSAL: SimpleProposal = {
  id: PROPOSAL.proposalId,
  chainId: 46,
  url: "https://gov.ringdao.com/proposal/0x21fe4d7b110c6263187dce84bd95a9017a9b0aa88f4136d65090432527797942",
  voteStart: +PROPOSAL.voteStart,
  voteEnd: +PROPOSAL.voteEnd,
  description: PROPOSAL.description,
  blockNumber: +PROPOSAL.blockNumber,
  blockTimestamp: +PROPOSAL.blockTimestamp,
  transactionHash: PROPOSAL.transactionHash,
  transactionLink: `https://explorer.darwinia.network/tx/${PROPOSAL.transactionHash}`,
};
