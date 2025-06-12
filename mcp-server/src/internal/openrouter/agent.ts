import { Service } from "typedi";
import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { EnvReader } from "../../integration/env-reader";
import { GenerateTextOptions } from "./types";

@Service()
export class OpenrouterAgent {
  private _openrouter: OpenRouterProvider | undefined;

  constructor(apiKey: string) {}

  private get openrouter(): OpenRouterProvider {
    if (!this._openrouter) {
      this._openrouter = createOpenRouter({
        apiKey: EnvReader.env("OPENROUTER_API_KEY"),
      });
    }
    return this._openrouter;
  }

  private betterModel(input?: string) {
    const def = EnvReader.env("OPENROUTER_DEFAULT_MODEL", {
      defaultValue: "google/gemini-2.5-flash-preview",
    })!;
    return this.openrouter(input ?? def);
  }

  async generateText(options: GenerateTextOptions): Promise<string> {
    const response = await generateText({
      model: this.betterModel(options.model),
      system: options.system,
      prompt: options.prompt,
    });
    return response.text;
  }
}
