import * as vscode from "vscode";
import { sanitizeConfig, type ExtensionConfig } from "./settings";

export const CONFIG_SECTION = "bilingualMarkdown";

export function readConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return sanitizeConfig({
    provider: config.get("provider"),
    targetLanguage: config.get("targetLanguage"),
    anthropicModel: config.get("anthropic.model"),
    openaiModel: config.get("openai.model"),
    openaiBaseUrl: config.get("openai.baseUrl"),
    reasoningEffort: config.get("reasoningEffort"),
    styleInstructions: config.get("styleInstructions"),
    glossary: config.get("glossary"),
    maxConcurrentRequests: config.get("maxConcurrentRequests"),
    batchCharacterLimit: config.get("batchCharacterLimit"),
    syncScroll: config.get("syncScroll"),
  });
}
