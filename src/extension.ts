import * as vscode from "vscode";
import { CONFIG_SECTION, modelSettingOf, readConfig } from "./config";
import { createMarkdownEngine } from "./markdown/engine";
import { RowRenderer } from "./markdown/render";
import { PreviewManager } from "./preview/previewManager";
import { VIEW_TYPE } from "./preview/previewPanel";
import { PROVIDERS } from "./providers/catalog";
import { ProviderFactory, apiKeyFor, createProvider, listModels } from "./providers/factory";
import { KEY_PROVIDER_IDS, PROVIDER_IDS, isKeyProviderId, type KeyProviderId, type ProviderId } from "./providers/types";
import { COPILOT_VENDOR, VsCodeLmProvider } from "./providers/vscodeLm";
import { ApiKeyStore } from "./secrets";
import {
  mergeGlossaries,
  modelLabelOf,
  modelOf,
  parseGlossaryFile,
  providerLabel,
  providerSettingsOf,
  serviceConfigOf,
  translationSettingsChanged,
} from "./settings";
import { isViewMode, type HostAction } from "./shared/protocol";
import { TranslationCache, type CacheStore } from "./translate/cache";
import { TranslationService } from "./translate/service";

const MODE_STATE_KEY = "bilingualMarkdown.viewMode";

/** A team's glossary, kept in the repository. Read only in a trusted workspace. */
export const GLOSSARY_FILE = ".vscode/translation-glossary.json";

let cachesToFlush: TranslationCache[] = [];

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const cache = new TranslationCache(new FileCacheStore(vscode.Uri.joinPath(context.globalStorageUri, "translation-cache.json")));
  // The user's own edits are kept apart, so clearing the cache or retranslating never loses them.
  const edits = new TranslationCache(new FileCacheStore(vscode.Uri.joinPath(context.globalStorageUri, "translation-edits.json")), 5_000);
  cachesToFlush = [cache, edits];
  const keys = new ApiKeyStore(context.secrets);
  let workspaceGlossary = await readWorkspaceGlossary();
  await Promise.all([cache.load(), edits.load(), keys.load()]);

  let config = readConfig(workspaceGlossary);
  const justification = vscode.l10n.t("Markdown Translation Preview translates the Markdown you preview.");
  const factory = new ProviderFactory(
    (provider) => keys.get(provider),
    () => providerSettingsOf(config),
    (settings, apiKey) => (settings.provider === "vscode" ? new VsCodeLmProvider(settings.model, justification) : createProvider(settings, apiKey)),
  );
  const service = new TranslationService({
    cache,
    resolveProvider: () => factory.resolve(),
    getConfig: () => serviceConfigOf(config),
  });
  const md = createMarkdownEngine();
  const manager = new PreviewManager({
    extensionUri: context.extensionUri,
    md,
    renderer: new RowRenderer(md),
    service,
    edits,
    getConfig: () => config,
    runAction: (action) => void runHostAction(action, context.extension.id),
    onModeChanged: (mode) => void context.globalState.update(MODE_STATE_KEY, mode),
    defaultMode: () => {
      const saved = context.globalState.get<unknown>(MODE_STATE_KEY);
      return isViewMode(saved) ? saved : "both";
    },
  });

  const commands = new Commands(manager, keys, cache, service);
  const applyConfig = (): void => {
    const before = config;
    config = readConfig(workspaceGlossary);
    if (translationSettingsChanged(before, config)) {
      factory.invalidate();
      service.reset();
      manager.refreshAll();
    } else {
      // Comment translation changes what is split out for translation, not how it is translated.
      if (before.translateCodeComments !== config.translateCodeComments) manager.refreshAll();
      service.kick();
    }
  };
  const reloadGlossary = async (): Promise<void> => {
    workspaceGlossary = await readWorkspaceGlossary();
    applyConfig();
  };
  const glossaryWatcher = vscode.workspace.createFileSystemWatcher(`**/${GLOSSARY_FILE}`);
  context.subscriptions.push(
    keys,
    manager,
    { dispose: () => service.dispose() },
    vscode.window.registerWebviewPanelSerializer(VIEW_TYPE, manager),
    vscode.commands.registerCommand("bilingualMarkdown.openPreview", (uri?: unknown) => commands.openPreview(uri, false)),
    vscode.commands.registerCommand("bilingualMarkdown.openPreviewToSide", (uri?: unknown) => commands.openPreview(uri, true)),
    vscode.commands.registerCommand("bilingualMarkdown.retranslate", () => commands.retranslate()),
    vscode.commands.registerCommand("bilingualMarkdown.setApiKey", (provider?: unknown) => commands.setApiKey(provider)),
    vscode.commands.registerCommand("bilingualMarkdown.clearApiKey", () => commands.clearApiKey()),
    vscode.commands.registerCommand("bilingualMarkdown.switchProvider", () => commands.switchProvider()),
    vscode.commands.registerCommand("bilingualMarkdown.clearCache", () => commands.clearCache()),
    vscode.commands.registerCommand("bilingualMarkdown.chooseModel", () => commands.chooseModel()),
    vscode.commands.registerCommand("bilingualMarkdown.exportTranslation", (target?: unknown) => commands.exportTranslation(target)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_SECTION)) applyConfig();
    }),
    glossaryWatcher,
    glossaryWatcher.onDidCreate(() => void reloadGlossary()),
    glossaryWatcher.onDidChange(() => void reloadGlossary()),
    glossaryWatcher.onDidDelete(() => void reloadGlossary()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => void reloadGlossary()),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      void reloadGlossary();
      // Documents may now choose their own target language.
      manager.refreshAll();
    }),
    keys.onDidChange(() => {
      factory.invalidate();
      service.unblock();
    }),
    vscode.lm.onDidChangeChatModels(() => {
      if (config.provider !== "vscode") return;
      factory.invalidate();
      service.unblock();
    }),
  );
}

export async function deactivate(): Promise<void> {
  await Promise.all(cachesToFlush.map((cache) => cache.flush()));
}

/** The glossary files of all workspace folders, merged in folder order. */
async function readWorkspaceGlossary(): Promise<Record<string, string>> {
  if (!vscode.workspace.isTrusted) return {};
  const glossaries = await Promise.all(
    (vscode.workspace.workspaceFolders ?? []).map(async (folder) => {
      try {
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder.uri, GLOSSARY_FILE));
        return parseGlossaryFile(new TextDecoder().decode(bytes));
      } catch {
        return {};
      }
    }),
  );
  return mergeGlossaries(...glossaries);
}

class Commands {
  constructor(
    private readonly manager: PreviewManager,
    private readonly keys: ApiKeyStore,
    private readonly cache: TranslationCache,
    private readonly service: TranslationService,
  ) {}

  async openPreview(uri: unknown, toSide: boolean): Promise<void> {
    const document = await this.documentFor(uri);
    if (!document) {
      void vscode.window.showWarningMessage(vscode.l10n.t("Open a Markdown file first."));
      return;
    }
    this.manager.show(document, toSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active, toSide);
  }

  retranslate(): void {
    const preview = this.currentPreview();
    if (preview) preview.retranslate();
    else void vscode.window.showInformationMessage(vscode.l10n.t("Open a bilingual preview first."));
  }

  /** Saves the translation of the current preview. Tests pass the file to write to. */
  async exportTranslation(target?: unknown): Promise<vscode.Uri | undefined> {
    const preview = this.currentPreview();
    if (!preview) {
      void vscode.window.showInformationMessage(vscode.l10n.t("Open a bilingual preview first."));
      return undefined;
    }
    return preview.exportTranslation(target instanceof vscode.Uri ? target : undefined);
  }

  /** Picks the model of the current provider, from the models it offers or by typing an ID. */
  async chooseModel(): Promise<void> {
    const config = readConfig();
    const provider = config.provider;
    if (provider === "vscode") {
      await this.chooseVsCodeModel();
      return;
    }
    const label = providerLabel(provider);
    const settings = providerSettingsOf(config);
    const current = modelOf(config);
    const apiKey = apiKeyFor(settings, (id) => this.keys.get(id));
    const enter = {
      id: undefined,
      label: `$(edit) ${vscode.l10n.t("Enter a model ID...")}`,
      description: "",
      detail: apiKey === undefined ? vscode.l10n.t("Set the {0} API key to list its models.", label) : undefined,
      alwaysShow: true,
    };
    const items = (apiKey === undefined ? Promise.resolve([]) : listModels(settings, apiKey)).then(
      (models) => [
        enter,
        ...models.map((model) => ({
          id: model.id as string | undefined,
          label: model.name ?? model.id,
          description: [model.name ? model.id : "", model.id === current ? vscode.l10n.t("Current") : ""].filter(Boolean).join(" · "),
          detail: undefined,
          alwaysShow: false,
        })),
      ],
      (error: unknown) => [{ ...enter, detail: vscode.l10n.t("Could not list the models: {0}", error instanceof Error ? error.message : String(error)) }],
    );
    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: vscode.l10n.t("Translate with which {0} model? Now: {1}", label, current),
      matchOnDescription: true,
    });
    if (!picked) return;
    const model =
      picked.id ??
      (await vscode.window.showInputBox({
        title: vscode.l10n.t("{0} Model", label),
        prompt: vscode.l10n.t("The model ID, as the provider's API names it. Default: {0}", PROVIDERS[provider].defaultModel),
        value: current,
        ignoreFocusOut: true,
        validateInput: (input) => (input.trim() ? undefined : vscode.l10n.t("Enter a model ID.")),
      }))?.trim();
    if (!model) return;
    await vscode.workspace.getConfiguration(CONFIG_SECTION).update(modelSettingOf(provider), model, vscode.ConfigurationTarget.Global);
  }

  /** Picks the model for the VS Code Language Model API from the models VS Code offers. */
  private async chooseVsCodeModel(): Promise<void> {
    const models = await vscode.lm.selectChatModels();
    if (models.length === 0) {
      void vscode.window.showWarningMessage(vscode.l10n.t("No language models are available in VS Code. Install GitHub Copilot and sign in."));
      return;
    }
    const current = readConfig().models.vscode;
    const automatic = { id: "", label: vscode.l10n.t("Automatic"), description: vscode.l10n.t("The first GitHub Copilot model") };
    const items = [
      automatic,
      ...models
        .sort((a, b) => Number(b.vendor === COPILOT_VENDOR) - Number(a.vendor === COPILOT_VENDOR) || a.name.localeCompare(b.name))
        .map((model) => ({ id: model.id, label: model.name, description: `${model.vendor} · ${model.id}` })),
    ].map((item) => ({ ...item, picked: item.id === current }));
    const picked = await vscode.window.showQuickPick(items, { placeHolder: vscode.l10n.t("Translate with which language model?") });
    if (!picked) return;
    await vscode.workspace.getConfiguration(CONFIG_SECTION).update(modelSettingOf("vscode"), picked.id, vscode.ConfigurationTarget.Global);
  }

  async setApiKey(requested?: unknown): Promise<void> {
    const configured = readConfig().provider;
    const current = isKeyProviderId(configured) ? configured : "anthropic";
    const provider = isKeyProviderId(requested)
      ? requested
      : await this.pickKeyProvider(vscode.l10n.t("Which provider's API key do you want to set?"), current);
    if (!provider) return;
    const label = providerLabel(provider);
    const value = await vscode.window.showInputBox({
      title: vscode.l10n.t("{0} API Key", label),
      prompt: vscode.l10n.t("Stored in VS Code Secret Storage (your OS keychain), not in settings."),
      placeHolder: PROVIDERS[provider].keyPlaceholder,
      password: true,
      ignoreFocusOut: true,
      validateInput: (input) => {
        const key = input.trim();
        if (!key) return vscode.l10n.t("Enter an API key.");
        return /\s/.test(key) ? vscode.l10n.t("An API key has no spaces.") : undefined;
      },
    });
    if (value === undefined) return;
    await this.keys.set(provider, value.trim());
    if (provider === configured) {
      void vscode.window.showInformationMessage(vscode.l10n.t("Saved the {0} API key.", label));
      return;
    }
    const use = vscode.l10n.t("Use {0}", label);
    const answer = await vscode.window.showInformationMessage(vscode.l10n.t("Saved the {0} API key.", label), use);
    if (answer === use) await setProvider(provider);
  }

  async clearApiKey(): Promise<void> {
    const stored = KEY_PROVIDER_IDS.filter((provider) => this.keys.has(provider));
    if (stored.length === 0) {
      void vscode.window.showInformationMessage(vscode.l10n.t("No API keys are stored."));
      return;
    }
    const configured = readConfig().provider;
    const provider =
      stored.length === 1
        ? stored[0]
        : await this.pickKeyProvider(vscode.l10n.t("Which API key do you want to delete?"), isKeyProviderId(configured) ? configured : "anthropic", stored);
    if (!provider) return;
    const remove = vscode.l10n.t("Delete");
    const answer = await vscode.window.showWarningMessage(
      vscode.l10n.t("Delete the stored {0} API key?", providerLabel(provider)),
      { modal: true },
      remove,
    );
    if (answer === remove) await this.keys.delete(provider);
  }

  async switchProvider(): Promise<void> {
    const current = readConfig().provider;
    const provider = await this.pickProvider(vscode.l10n.t("Translate with"), current, PROVIDER_IDS);
    if (!provider || provider === current) return;
    await setProvider(provider);
    // An OpenAI-compatible server on this machine or a company gateway may need no key here.
    const ownEndpoint = provider === "openai" && readConfig().openaiBaseUrl !== "";
    if (isKeyProviderId(provider) && !this.keys.has(provider) && !ownEndpoint) await this.setApiKey(provider);
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
    await this.cache.flush();
    this.service.reset();
    this.manager.refreshAll();
    void vscode.window.showInformationMessage(vscode.l10n.t("Cleared the translation cache."));
  }

  private async pickProvider<T extends ProviderId>(placeHolder: string, current: ProviderId, candidates: readonly T[]): Promise<T | undefined> {
    const config = readConfig();
    const items = [...candidates]
      .sort((a, b) => Number(b === current) - Number(a === current))
      .map((id) => ({
        id,
        label: providerLabel(id),
        description: modelLabelOf({ ...config, provider: id }),
        detail:
          id === "vscode"
            ? vscode.l10n.t("No API key needed: uses GitHub Copilot or another model in VS Code")
            : this.keys.has(id)
              ? vscode.l10n.t("API key stored")
              : vscode.l10n.t("No API key yet"),
      }));
    return (await vscode.window.showQuickPick(items, { placeHolder }))?.id;
  }

  private pickKeyProvider(placeHolder: string, current: KeyProviderId, candidates: readonly KeyProviderId[] = KEY_PROVIDER_IDS) {
    return this.pickProvider(placeHolder, current, candidates);
  }

  private currentPreview() {
    const editor = vscode.window.activeTextEditor;
    return this.manager.activePreview ?? (editor ? this.manager.previewFor(editor.document.uri) : undefined);
  }

  private async documentFor(uri: unknown): Promise<vscode.TextDocument | undefined> {
    if (uri instanceof vscode.Uri) return vscode.workspace.openTextDocument(uri);
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.languageId === "markdown") return editor.document;
    return this.manager.activePreview?.textDocument;
  }
}

async function setProvider(provider: ProviderId): Promise<void> {
  await vscode.workspace.getConfiguration(CONFIG_SECTION).update("provider", provider, vscode.ConfigurationTarget.Global);
}

async function runHostAction(action: HostAction, extensionId: string): Promise<void> {
  switch (action) {
    case "setApiKey":
      await vscode.commands.executeCommand("bilingualMarkdown.setApiKey");
      break;
    case "switchProvider":
      await vscode.commands.executeCommand("bilingualMarkdown.switchProvider");
      break;
    case "chooseModel":
      await vscode.commands.executeCommand("bilingualMarkdown.chooseModel");
      break;
    case "openSettings":
      await vscode.commands.executeCommand("workbench.action.openSettings", `@ext:${extensionId}`);
      break;
    case "retranslate":
    case "retryFailed":
    case "resume":
    case "exportTranslation":
      // Handled by the preview itself.
      break;
  }
}

/** Persists the translation cache as one JSON file in the extension's global storage. */
class FileCacheStore implements CacheStore {
  constructor(private readonly uri: vscode.Uri) {}

  async read(): Promise<string | undefined> {
    try {
      return new TextDecoder().decode(await vscode.workspace.fs.readFile(this.uri));
    } catch {
      return undefined;
    }
  }

  async write(data: string): Promise<void> {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(this.uri, ".."));
    await vscode.workspace.fs.writeFile(this.uri, new TextEncoder().encode(data));
  }
}

