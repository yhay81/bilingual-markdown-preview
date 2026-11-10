import * as vscode from "vscode";
import { moveSettings, type SettingsLevel } from "./migration";
import { PROVIDER_IDS, type ProviderId } from "./providers/types";
import { mergeGlossaries, sanitizeConfig, type ExtensionConfig } from "./settings";

export const CONFIG_SECTION = "markdownTranslation";

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

/**
 * Moves the settings of version 0.1 to their current names, in the user's settings, the
 * workspace's, and each folder's. `keys` are the setting keys without the section.
 */
export async function migrateLegacySettings(keys: readonly string[]): Promise<void> {
  const level = (
    scope: vscode.Uri | undefined,
    target: vscode.ConfigurationTarget,
    pick: (inspected: NonNullable<ReturnType<vscode.WorkspaceConfiguration["inspect"]>>) => unknown,
  ): SettingsLevel => {
    const config = vscode.workspace.getConfiguration(undefined, scope);
    return {
      read: (key) => {
        const inspected = config.inspect(key);
        return inspected && pick(inspected);
      },
      write: (key, value) => Promise.resolve(config.update(key, value, target)),
    };
  };
  await moveSettings(level(undefined, vscode.ConfigurationTarget.Global, (i) => i.globalValue), keys, CONFIG_SECTION);
  if (!vscode.workspace.workspaceFolders?.length) return;
  await moveSettings(level(undefined, vscode.ConfigurationTarget.Workspace, (i) => i.workspaceValue), keys, CONFIG_SECTION);
  // In a workspace of one folder, the folder's settings are the workspace's, moved above.
  if (!vscode.workspace.workspaceFile) return;
  for (const folder of vscode.workspace.workspaceFolders) {
    await moveSettings(
      level(folder.uri, vscode.ConfigurationTarget.WorkspaceFolder, (i) => i.workspaceFolderValue),
      keys,
      CONFIG_SECTION,
    );
  }
}
