import * as vscode from "vscode";
import { mergeGlossaries, sanitizeConfig, type ExtensionConfig } from "./settings";

export const CONFIG_SECTION = "bilingualMarkdown";

/** `workspaceGlossary` comes from the workspace's glossary files; the settings win for a term in both. */
export function readConfig(workspaceGlossary: Readonly<Record<string, string>> = {}): ExtensionConfig {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const settings = sanitizeConfig({
    provider: config.get("provider"),
    targetLanguage: config.get("targetLanguage"),
    anthropicModel: config.get("anthropic.model"),
    openaiModel: config.get("openai.model"),
    openaiBaseUrl: config.get("openai.baseUrl"),
    vscodeModel: config.get("vscode.model"),
    reasoningEffort: config.get("reasoningEffort"),
    styleInstructions: config.get("styleInstructions"),
    glossary: config.get("glossary"),
    translateCodeComments: config.get("translateCodeComments"),
    maxConcurrentRequests: config.get("maxConcurrentRequests"),
    batchCharacterLimit: config.get("batchCharacterLimit"),
    tokenLimit: config.get("tokenLimit"),
    syncScroll: config.get("syncScroll"),
  });
  return { ...settings, glossary: mergeGlossaries(workspaceGlossary, settings.glossary) };
}
