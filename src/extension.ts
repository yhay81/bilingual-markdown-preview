import * as vscode from "vscode";
import { CONFIG_SECTION, readConfig } from "./config";
import { createMarkdownEngine } from "./markdown/engine";
import { RowRenderer } from "./markdown/render";
import { PreviewManager } from "./preview/previewManager";
import { VIEW_TYPE } from "./preview/previewPanel";
import { ProviderFactory } from "./providers/factory";
import { PROVIDER_IDS, type ProviderId } from "./providers/types";
import { ApiKeyStore } from "./secrets";
import { providerLabel, providerSettingsOf, serviceConfigOf, translationSettingsChanged } from "./settings";
import { isViewMode, type HostAction } from "./shared/protocol";
import { TranslationCache, type CacheStore } from "./translate/cache";
import { TranslationService } from "./translate/service";

const MODE_STATE_KEY = "bilingualMarkdown.viewMode";

let cacheToFlush: TranslationCache | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const cache = new TranslationCache(new FileCacheStore(vscode.Uri.joinPath(context.globalStorageUri, "translation-cache.json")));
  cacheToFlush = cache;
  const keys = new ApiKeyStore(context.secrets);
  await Promise.all([cache.load(), keys.load()]);

  let config = readConfig();
  const factory = new ProviderFactory(
    (provider) => keys.get(provider),
    () => providerSettingsOf(config),
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
    getConfig: () => config,
    runAction: (action) => void runHostAction(action, context.extension.id),
    onModeChanged: (mode) => void context.globalState.update(MODE_STATE_KEY, mode),
    defaultMode: () => {
      const saved = context.globalState.get<unknown>(MODE_STATE_KEY);
      return isViewMode(saved) ? saved : "both";
    },
  });

  const commands = new Commands(manager, keys, cache, service);
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
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration(CONFIG_SECTION)) return;
      const before = config;
      config = readConfig();
      if (translationSettingsChanged(before, config)) {
        factory.invalidate();
        service.reset();
        manager.refreshAll();
      } else {
        // Comment translation changes what is split out for translation, not how it is translated.
        if (before.translateCodeComments !== config.translateCodeComments) manager.refreshAll();
        service.kick();
      }
    }),
    keys.onDidChange(() => {
      factory.invalidate();
      service.unblock();
    }),
  );
}

export async function deactivate(): Promise<void> {
  await cacheToFlush?.flush();
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
    const editor = vscode.window.activeTextEditor;
    const preview = this.manager.activePreview ?? (editor ? this.manager.previewFor(editor.document.uri) : undefined);
    if (preview) preview.retranslate();
    else void vscode.window.showInformationMessage(vscode.l10n.t("Open a bilingual preview first."));
  }

  async setApiKey(requested?: unknown): Promise<void> {
    const current = readConfig().provider;
    const provider = PROVIDER_IDS.includes(requested as ProviderId)
      ? (requested as ProviderId)
      : await this.pickProvider(vscode.l10n.t("Which provider's API key do you want to set?"), current);
    if (!provider) return;
    const label = providerLabel(provider);
    const value = await vscode.window.showInputBox({
      title: vscode.l10n.t("{0} API Key", label),
      prompt: vscode.l10n.t("Stored in VS Code Secret Storage (your OS keychain), not in settings."),
      placeHolder: provider === "anthropic" ? "sk-ant-..." : "sk-...",
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
    if (provider === current) {
      void vscode.window.showInformationMessage(vscode.l10n.t("Saved the {0} API key.", label));
      return;
    }
    const use = vscode.l10n.t("Use {0}", label);
    const answer = await vscode.window.showInformationMessage(vscode.l10n.t("Saved the {0} API key.", label), use);
    if (answer === use) await setProvider(provider);
  }

  async clearApiKey(): Promise<void> {
    const stored = PROVIDER_IDS.filter((provider) => this.keys.has(provider));
    if (stored.length === 0) {
      void vscode.window.showInformationMessage(vscode.l10n.t("No API keys are stored."));
      return;
    }
    const provider =
      stored.length === 1 ? stored[0] : await this.pickProvider(vscode.l10n.t("Which API key do you want to delete?"), readConfig().provider, stored);
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
    const provider = await this.pickProvider(vscode.l10n.t("Translate with"), current);
    if (!provider || provider === current) return;
    await setProvider(provider);
    if (!this.keys.has(provider)) await this.setApiKey(provider);
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
    await this.cache.flush();
    this.service.reset();
    this.manager.refreshAll();
    void vscode.window.showInformationMessage(vscode.l10n.t("Cleared the translation cache."));
  }

  private async pickProvider(
    placeHolder: string,
    current: ProviderId,
    candidates: readonly ProviderId[] = PROVIDER_IDS,
  ): Promise<ProviderId | undefined> {
    const config = readConfig();
    const items = [...candidates]
      .sort((a, b) => Number(b === current) - Number(a === current))
      .map((id) => ({
        id,
        label: providerLabel(id),
        description: id === "anthropic" ? config.anthropicModel : config.openaiModel,
        detail: this.keys.has(id) ? vscode.l10n.t("API key stored") : vscode.l10n.t("No API key yet"),
      }));
    return (await vscode.window.showQuickPick(items, { placeHolder }))?.id;
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
    case "openSettings":
      await vscode.commands.executeCommand("workbench.action.openSettings", `@ext:${extensionId}`);
      break;
    case "retranslate":
    case "retryFailed":
    case "resume":
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

