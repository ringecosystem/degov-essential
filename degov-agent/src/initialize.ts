import { Service } from "typedi";
import { FastifyInstance } from "fastify";
import { TwitterService } from "./services/twitter";
import { EnvReader } from "./integration/env-reader";
import { DegovAgentSource } from "./internal/agent-source";
import handlebars from "handlebars";
import { marked } from "marked";

@Service()
export class DegovMcpServerInitializer {
  constructor(
    private readonly twitterService: TwitterService,
    private readonly degovAgentSource: DegovAgentSource
  ) {}

  async init(fastify: FastifyInstance) {
    await this.ensureEnv();
    await this.initTwitterApi(fastify);
    await this.degovAgentSource.refresh(fastify);
    this.registerViewEngine();
  }

  private async ensureEnv() {
    EnvReader.env("OPENROUTER_API_KEY");
    EnvReader.env("DEGOV_AGENT_PRIVATE_KEY");
    EnvReader.twitterEnv();
    EnvReader.aiModel();
  }

  private async initTwitterApi(fastify: FastifyInstance) {
    await this.twitterService.loadAuthorization(fastify);
  }

  private registerViewEngine() {
    handlebars.registerHelper("formatDate", function (date: string | Date) {
      if (!date) return "N/A";
      const d = new Date(date);
      return d.toISOString();
    });

    handlebars.registerHelper(
      "formatWeight",
      function (weight: string | number) {
        if (!weight) return "0";
        const num = typeof weight === "string" ? parseFloat(weight) : weight;
        if (num >= 1e18) {
          return `${(num / 1e18).toFixed(2)} tokens`;
        } else if (num >= 1e15) {
          return `${(num / 1e15).toFixed(2)}K tokens`;
        } else if (num >= 1e12) {
          return `${(num / 1e12).toFixed(2)}M tokens`;
        }
        return num.toString();
      }
    );

    handlebars.registerHelper(
      "percentage",
      function (value: number, total: number) {
        if (!total || total === 0) return 0;
        return Math.round((value / total) * 100);
      }
    );

    handlebars.registerHelper("multiply", function (a: number, b: number) {
      return (a || 0) * (b || 0);
    });

    handlebars.registerHelper("toLowerCase", function (str: string) {
      return str ? str.toLowerCase() : "";
    });

    handlebars.registerHelper("add", function (...args: any[]) {
      const numbers = args.slice(0, -1);
      return numbers.reduce((sum, num) => sum + (num || 0), 0);
    });

    handlebars.registerHelper("gt", function (a: number, b: number) {
      return a > b;
    });

    handlebars.registerHelper("eq", function (a: any, b: any) {
      return a === b;
    });

    handlebars.registerHelper("markdown", function (text: string) {
      if (!text) return "";
      marked.setOptions({
        async: false,
        breaks: true,
        gfm: true,
      });
      const parsedContent = marked.parse(text);
      return new handlebars.SafeString(parsedContent as string);
    });

    handlebars.registerHelper(
      "truncate",
      function (text: string, length: number) {
        if (!text) return "";
        if (text.length <= length) return text;
        return text.substring(0, length) + "...";
      }
    );

    handlebars.registerHelper(
      "startsWith",
      function (str: string, prefix: string) {
        if (!str || !prefix) return false;
        return str.startsWith(prefix);
      }
    );

    handlebars.registerHelper("or", function (...args: any[]) {
      const values = args.slice(0, -1);
      return values.some((value) => !!value);
    });
  }
}
