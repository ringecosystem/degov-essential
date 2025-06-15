import { Service } from "typedi";
import {
  createOpenRouter,
  OpenRouterProvider,
} from "@openrouter/ai-sdk-provider";
import { EnvReader } from "../../integration/env-reader";

@Service()
export class OpenrouterAgent {
  private _openrouter: OpenRouterProvider | undefined;

  constructor() {}

  get openrouter(): OpenRouterProvider {
    if (!this._openrouter) {
      this._openrouter = createOpenRouter({
        apiKey: EnvReader.env("OPENROUTER_API_KEY"),
      });
    }
    return this._openrouter;
  }
}
