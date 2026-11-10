import * as vscode from "vscode";
import { PROVIDER_IDS, type ProviderId } from "./providers/types";
import { mergeGlossaries, sanitizeConfig, type ExtensionConfig } from "./settings";

export const CONFIG_SECTION = "bilingualMarkdown";

/** `workspaceGlossary` comes from the workspace's glossary files; the settings win for a term in both. */
export function readConfig(workspaceGlossary: Readonly<Record<string, string>> = {}): ExtensionConfig {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const settings = sanitizeConfig({
    provider: config.get("provider"),
    targetLanguage: config.get("targetLanguage"),
    models: Object.fromEntries(PROVIDER_IDS.map((id) => [id, config.get(modelSettingOf(id))])),
    openaiBaseUrl: config.get("openai.baseUrl"),
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

/** The setting, under the extension's section, that holds a provider's model. */
export function modelSettingOf(provider: ProviderId): string {
  return `${provider}.model`;
}
