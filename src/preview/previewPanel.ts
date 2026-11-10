import type { MarkdownIt } from "markdown-it";
import * as vscode from "vscode";
import { documentTargetLanguage } from "../markdown/frontMatter";
import type { RowRenderer } from "../markdown/render";
import type { Row, SegmentedDocument, Unit } from "../markdown/segment";
import { segmentDocument } from "../markdown/segment";
import { Slugger } from "../markdown/slug";
import { fingerprintOf, modelLabelOf, providerLabel, type ExtensionConfig } from "../settings";
import {
  parseWebviewMessage,
  type HostAction,
  type HostToWebview,
  type InitData,
  type Notice,
  type NoticeAction,
  type ProgressInfo,
  type RowPayload,
  type RowUpdate,
  type UiStrings,
  type ViewMode,
} from "../shared/protocol";
import { translationKey } from "../translate/keys";
import { unmask } from "../translate/mask";
import type { SegmentKind } from "../translate/prompt";
import type { ServiceChange, TranslationJob, TranslationService } from "../translate/service";
import { buildWebviewHtml } from "./html";

export const VIEW_TYPE = "bilingualMarkdown.preview";

const RENDER_DELAY_MS = 200;
const TRANSLATE_DELAY_MS = 1000;
const FLUSH_DELAY_MS = 80;
const SCROLL_ECHO_MS = 300;

export interface PreviewContext {
  extensionUri: vscode.Uri;
  md: MarkdownIt;
  renderer: RowRenderer;
  service: TranslationService;
  getConfig(): ExtensionConfig;
  /** Runs actions the preview cannot handle itself, such as setting the API key. */
  runAction(action: HostAction): void;
  onModeChanged(mode: ViewMode): void;
}

interface PreparedRow {
  row: Row;
  sourceHtml: string;
  /** Cache key per unit, or undefined for units that are shown as written. */
  keys: Array<string | undefined>;
  /** What the webview shows now, to send only real changes. */
  sent?: RowUpdate;
}

interface Prepared {
  version: number;
  doc: SegmentedDocument;
  rows: PreparedRow[];
  /** Rows containing each key. Its size is the number of distinct segments to translate. */
  rowsByKey: Map<string, number[]>;
  /** Set when the document's front matter chooses the language; otherwise the configured one is used. */
  documentLanguage: string | undefined;
  targetLanguage: string;
  label: string;
}

/** Characters of preceding text sent with a request, so terms and tone carry over between requests. */
const CONTEXT_CHARS = 400;

let nextOwner = 1;

/** One preview panel showing one Markdown document with its translation. */
export class BilingualPreview implements vscode.Disposable {
  readonly owner = `preview-${nextOwner++}`;
  private document: vscode.TextDocument;
  private ready = false;
  private version = 0;
  private current: Prepared | undefined;
  private readonly dirtyRows = new Set<number>();
  private renderTimer: ReturnType<typeof setTimeout> | undefined;
  private translateTimer: ReturnType<typeof setTimeout> | undefined;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private ignoreEditorScrollUntil = 0;
  private lastNotice = "";
  private disposed = false;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly disposeEmitter = new vscode.EventEmitter<void>();
  private readonly activeEmitter = new vscode.EventEmitter<void>();
  readonly onDidDispose = this.disposeEmitter.event;
  readonly onDidBecomeActive = this.activeEmitter.event;

  constructor(
    readonly panel: vscode.WebviewPanel,
    document: vscode.TextDocument,
    private mode: ViewMode,
    private readonly context: PreviewContext,
  ) {
    this.document = document;
    panel.title = titleOf(document);
    panel.webview.options = webviewOptions(context.extensionUri, document.uri);
    panel.webview.html = buildWebviewHtml(panel.webview, context.extensionUri, document.uri, this.initData());

    this.disposables.push(
      panel.onDidDispose(() => this.dispose()),
      panel.webview.onDidReceiveMessage((raw: unknown) => this.onMessage(raw)),
      panel.onDidChangeViewState(({ webviewPanel }) => {
        // Hidden webviews are discarded; the page sends "ready" again when shown.
        if (!webviewPanel.visible) this.ready = false;
        if (webviewPanel.active) this.activeEmitter.fire();
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() !== this.uri) return;
        this.document = event.document;
        this.schedule("render");
      }),
      vscode.window.onDidChangeTextEditorVisibleRanges((event) => this.onEditorScroll(event)),
      context.service.onDidChange((change) => this.onServiceChange(change)),
    );
  }

  get uri(): string {
    return this.document.uri.toString();
  }

  get textDocument(): vscode.TextDocument {
    return this.document;
  }

  reveal(column: vscode.ViewColumn, preserveFocus: boolean): void {
    this.panel.reveal(column, preserveFocus);
  }

  /** Re-renders with the current settings, for example after they changed. */
  refresh(): void {
    this.render(true);
  }

  /** Translates the whole document again, ignoring cached translations. */
  retranslate(): void {
    if (this.current) this.context.service.forget(this.current.rowsByKey.keys());
    this.render(true);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const timer of [this.renderTimer, this.translateTimer, this.flushTimer]) clearTimeout(timer);
    this.context.service.release(this.owner);
    for (const disposable of this.disposables) disposable.dispose();
    this.panel.dispose();
    this.disposeEmitter.fire();
    this.disposeEmitter.dispose();
    this.activeEmitter.dispose();
  }

  private initData(): InitData {
    return { documentUri: this.uri, lang: vscode.env.language, mode: this.mode, strings: uiStrings() };
  }

  private onMessage(raw: unknown): void {
    const message = parseWebviewMessage(raw);
    if (!message) return;
    switch (message.type) {
      case "ready":
        this.ready = true;
        this.render(true);
        this.syncToEditor();
        break;
      case "openLink":
        void this.openLink(message.href);
        break;
      case "visibleLine":
        this.onPreviewScroll(message.line);
        break;
      case "retryRow": {
        const row = this.current?.rows[message.index];
        if (row) this.context.service.retry(definedKeys(row.keys));
        break;
      }
      case "action":
        this.onAction(message.action);
        break;
      case "modeChanged":
        this.mode = message.mode;
        this.context.onModeChanged(message.mode);
        break;
    }
  }

  private onAction(action: HostAction): void {
    switch (action) {
      case "retranslate":
        this.retranslate();
        break;
      case "resume":
        this.context.service.resume();
        break;
      case "retryFailed": {
        const prepared = this.current;
        if (!prepared) return;
        const failed = [...prepared.rowsByKey.keys()].filter((key) => this.context.service.getResult(key)?.state === "error");
        this.context.service.retry(failed);
        break;
      }
      default:
        this.context.runAction(action);
    }
  }

  private schedule(what: "render" | "translate"): void {
    if (what === "render") {
      clearTimeout(this.renderTimer);
      this.renderTimer = setTimeout(() => this.render(false), RENDER_DELAY_MS);
    } else {
      // Wait for a pause in typing, so half-written sentences are not sent for translation.
      clearTimeout(this.translateTimer);
      this.translateTimer = setTimeout(() => this.requestTranslations(), TRANSLATE_DELAY_MS);
    }
  }

  private render(requestNow: boolean): void {
    clearTimeout(this.renderTimer);
    if (!this.ready || this.disposed) return;
    const prepared = this.prepare();
    this.current = prepared;
    this.dirtyRows.clear();
    const rows = prepared.rows.map((entry, index): RowPayload => {
      const state = this.rowState(prepared, index);
      entry.sent = state;
      return {
        index,
        shared: entry.row.shared,
        line: entry.row.startLine,
        endLine: entry.row.endLine,
        classes: entry.row.classes,
        sourceHtml: entry.sourceHtml,
        translationHtml: state.translationHtml,
        status: state.status,
        message: state.message,
      };
    });
    const notice = this.notice(prepared);
    this.lastNotice = JSON.stringify(notice);
    this.post({ type: "render", version: prepared.version, rows, progress: this.progress(prepared), notice });
    if (requestNow) this.requestTranslations();
    else this.schedule("translate");
  }

  private prepare(): Prepared {
    const config = this.context.getConfig();
    const text = this.document.getText();
    // Like the target language setting, the document's choice counts only in a trusted workspace.
    const documentLanguage = vscode.workspace.isTrusted ? documentTargetLanguage(text) : undefined;
    const targetLanguage = documentLanguage ?? config.targetLanguage;
    const fingerprint = fingerprintOf({ ...config, targetLanguage });
    const doc = segmentDocument(this.context.md, text, {
      targetLanguage,
      translateCodeComments: config.translateCodeComments,
    });
    const slugger = new Slugger();
    const rowsByKey = new Map<string, number[]>();
    const rows = doc.rows.map((row, index): PreparedRow => {
      const keys = row.shared
        ? []
        : row.units.map((unit) => (unit.translatable ? translationKey(fingerprint, unit.masked, unit.placeholders, kindOf(unit)) : undefined));
      for (const key of definedKeys(keys)) {
        const indexes = rowsByKey.get(key);
        if (!indexes) rowsByKey.set(key, [index]);
        else if (indexes.at(-1) !== index) indexes.push(index);
      }
      return { row, sourceHtml: this.context.renderer.renderSource(row, doc.env, slugger), keys };
    });
    return {
      version: ++this.version,
      doc,
      rows,
      rowsByKey,
      documentLanguage,
      targetLanguage,
      label: `${modelLabelOf(config)} → ${targetLanguage}`,
    };
  }

  private requestTranslations(): void {
    clearTimeout(this.translateTimer);
    const prepared = this.current;
    if (!prepared || this.disposed) return;
    const jobs: TranslationJob[] = [];
    let before = "";
    for (const { row, keys } of prepared.rows) {
      row.units.forEach((unit, k) => {
        const key = keys[k];
        if (key) {
          jobs.push({
            key,
            masked: unit.masked,
            placeholders: unit.placeholders,
            line: row.startLine,
            kind: kindOf(unit),
            targetLanguage: prepared.documentLanguage,
            context: before || undefined,
          });
        }
        if (!unit.comment) before = `${before}\n${contextText(unit.masked)}`.slice(-CONTEXT_CHARS);
      });
    }
    this.context.service.request(this.owner, jobs);
  }

  private rowState(prepared: Prepared, index: number): RowUpdate {
    const entry = prepared.rows[index]!;
    if (entry.row.shared) return { index, status: "shared" };
    const texts: Array<string | undefined> = [];
    let pending = false;
    let warning = false;
    let error: string | undefined;
    entry.row.units.forEach((unit, k) => {
      const key = entry.keys[k];
      const result = key ? this.context.service.getResult(key) : undefined;
      if (!key) {
        texts.push(undefined);
      } else if (!result || result.state === "queued" || result.state === "inflight") {
        pending = true;
      } else if (result.state === "error") {
        error ??= result.error.message;
      } else {
        if (result.problems.length > 0) warning = true;
        texts.push(unmask(result.text, unit.placeholders));
      }
    });
    if (pending) return { index, status: "translating" };
    if (error !== undefined) return { index, status: "error", message: error };
    const translationHtml = this.context.renderer.renderTranslation(entry.row, prepared.doc.env, texts);
    return warning
      ? { index, status: "warning", translationHtml, message: vscode.l10n.t("This translation may be missing code, links, or formatting.") }
      : { index, status: "done", translationHtml };
  }

  private progress(prepared: Prepared): ProgressInfo {
    let done = 0;
    let failed = 0;
    for (const key of prepared.rowsByKey.keys()) {
      const state = this.context.service.getResult(key)?.state;
      if (state === "done") done++;
      else if (state === "error") failed++;
    }
    const usage = this.context.service.getUsage();
    const tokens = usage.inputTokens + usage.outputTokens;
    return { total: prepared.rowsByKey.size, done, failed, label: prepared.label, ...(tokens > 0 ? { tokens } : {}) };
  }

  private notice(prepared: Prepared): Notice | null {
    const config = this.context.getConfig();
    const provider = providerLabel(config.provider);
    const model = modelLabelOf(config);
    const setKey: NoticeAction = { label: vscode.l10n.t("Set API Key"), action: "setApiKey" };
    const switchProvider: NoticeAction = { label: vscode.l10n.t("Switch Provider"), action: "switchProvider" };
    const openSettings: NoticeAction = { label: vscode.l10n.t("Open Settings"), action: "openSettings" };
    const chooseModel: NoticeAction = { label: vscode.l10n.t("Choose Model"), action: "chooseModel" };
    const tryAgain: NoticeAction = { label: vscode.l10n.t("Try Again"), action: "resume" };
    const block = this.context.service.getBlock();
    const detail = block?.message ? ` (${block.message})` : "";

    if (config.provider === "vscode") {
      switch (block?.reason) {
        case "permission":
          return {
            severity: "error",
            blocking: true,
            message:
              vscode.l10n.t(
                "VS Code did not allow this extension to use the language model. Allow it in the Accounts menu under Manage Language Model Access, then try again.",
              ) + detail,
            actions: [tryAgain, switchProvider],
          };
        case "notFound":
        case "auth":
          return {
            severity: "error",
            blocking: true,
            message: vscode.l10n.t("No language model is available in VS Code. Install GitHub Copilot and sign in, or choose another model.") + detail,
            actions: [chooseModel, tryAgain, switchProvider],
          };
        default:
          break;
      }
    }

    switch (block?.reason) {
      case "tokenLimit":
        return {
          severity: "info",
          blocking: true,
          message: vscode.l10n.t("Translation paused: this session reached the token limit of {0}.", config.tokenLimit.toLocaleString()),
          actions: [{ label: vscode.l10n.t("Continue"), action: "resume" }, openSettings],
        };
      case "missingKey":
        return {
          severity: "info",
          blocking: true,
          message: vscode.l10n.t("Set your {0} API key to start translating. It is kept in VS Code Secret Storage.", provider),
          actions: [setKey, switchProvider],
        };
      case "invalidBaseUrl":
        return {
          severity: "error",
          blocking: true,
          message: vscode.l10n.t("The OpenAI base URL must start with https:// (or http://localhost)."),
          actions: [openSettings],
        };
      case "auth":
        return {
          severity: "error",
          blocking: true,
          message: vscode.l10n.t("{0} rejected the API key.", provider) + detail,
          actions: [setKey, switchProvider],
        };
      case "permission":
        return {
          severity: "error",
          blocking: true,
          message: vscode.l10n.t("This API key is not allowed to use {0}.", model) + detail,
          actions: [openSettings, setKey],
        };
      case "notFound":
        return {
          severity: "error",
          blocking: true,
          message: vscode.l10n.t("Model {0} was not found. Check the model ID in the settings.", model) + detail,
          actions: [openSettings, switchProvider],
        };
      case undefined:
        break;
    }

    const { failed } = this.progress(prepared);
    if (failed === 0) return null;
    const lastError = this.context.service.getLastError();
    return {
      severity: "warning",
      blocking: false,
      message: vscode.l10n.t("{0} segments could not be translated.", failed) + (lastError ? ` (${lastError.message})` : ""),
      actions: [{ label: vscode.l10n.t("Retry"), action: "retryFailed" }],
    };
  }

  private onServiceChange(change: ServiceChange): void {
    const prepared = this.current;
    if (!prepared || !this.ready) return;
    for (const key of change.keys) for (const index of prepared.rowsByKey.get(key) ?? []) this.dirtyRows.add(index);
    if (this.dirtyRows.size > 0 || change.stateChanged) {
      this.flushTimer ??= setTimeout(() => this.flush(), FLUSH_DELAY_MS);
    }
  }

  private flush(): void {
    this.flushTimer = undefined;
    const prepared = this.current;
    if (!prepared || !this.ready || this.disposed) return;
    const updates: RowUpdate[] = [];
    for (const index of this.dirtyRows) {
      const entry = prepared.rows[index];
      if (!entry) continue;
      const state = this.rowState(prepared, index);
      if (sameUpdate(entry.sent, state)) continue;
      entry.sent = state;
      updates.push(state);
    }
    this.dirtyRows.clear();
    this.post({ type: "updateRows", version: prepared.version, rows: updates, progress: this.progress(prepared) });
    const notice = this.notice(prepared);
    const serialized = JSON.stringify(notice);
    if (serialized !== this.lastNotice) {
      this.lastNotice = serialized;
      this.post({ type: "notice", notice });
    }
  }

  private onEditorScroll(event: vscode.TextEditorVisibleRangesChangeEvent): void {
    if (event.textEditor.document.uri.toString() !== this.uri) return;
    const line = event.visibleRanges[0]?.start.line;
    if (line === undefined) return;
    this.context.service.setFocus(this.owner, line);
    if (!this.ready || !this.context.getConfig().syncScroll || Date.now() < this.ignoreEditorScrollUntil) return;
    this.post({ type: "scrollToLine", line });
  }

  private onPreviewScroll(line: number): void {
    this.context.service.setFocus(this.owner, Math.floor(line));
    if (!this.context.getConfig().syncScroll) return;
    const editor = vscode.window.visibleTextEditors.find((candidate) => candidate.document.uri.toString() === this.uri);
    if (!editor) return;
    // Revealing scrolls the editor, which would scroll the preview back; ignore that echo.
    this.ignoreEditorScrollUntil = Date.now() + SCROLL_ECHO_MS;
    const target = Math.max(0, Math.min(editor.document.lineCount - 1, Math.floor(line)));
    editor.revealRange(new vscode.Range(target, 0, target, 0), vscode.TextEditorRevealType.AtTop);
  }

  private syncToEditor(): void {
    const editor = vscode.window.visibleTextEditors.find((candidate) => candidate.document.uri.toString() === this.uri);
    const line = editor?.visibleRanges[0]?.start.line;
    if (line === undefined) return;
    this.context.service.setFocus(this.owner, line);
    if (this.context.getConfig().syncScroll && line > 0) this.post({ type: "scrollToLine", line });
  }

  /** Links never navigate the webview: web links open in the browser, relative paths in VS Code. */
  private async openLink(href: string): Promise<void> {
    const link = href.trim();
    if (!link || link.startsWith("#") || link.startsWith("//")) return;
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(link)?.[1]?.toLowerCase();
    if (scheme) {
      if (scheme === "http" || scheme === "https" || scheme === "mailto") {
        await vscode.env.openExternal(vscode.Uri.parse(link, true));
      }
      return;
    }
    const target = this.resolveRelative(link);
    if (target) await vscode.commands.executeCommand("vscode.open", target);
  }

  private resolveRelative(link: string): vscode.Uri | undefined {
    const path = link.split(/[?#]/, 1)[0];
    if (!path) return undefined;
    let decoded = path;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      // Keep the raw path.
    }
    if (decoded.startsWith("/")) {
      const folder = vscode.workspace.getWorkspaceFolder(this.document.uri);
      return folder ? vscode.Uri.joinPath(folder.uri, decoded) : undefined;
    }
    if (this.document.uri.scheme === "untitled") return undefined;
    return vscode.Uri.joinPath(this.document.uri, "..", decoded);
  }

  private post(message: HostToWebview): void {
    if (this.ready && !this.disposed) void this.panel.webview.postMessage(message);
  }
}

export function titleOf(document: vscode.TextDocument): string {
  const name = document.uri.path.split("/").pop() || document.fileName;
  return vscode.l10n.t("Bilingual: {0}", name);
}

export function webviewOptions(extensionUri: vscode.Uri, documentUri: vscode.Uri): vscode.WebviewOptions {
  const roots = [vscode.Uri.joinPath(extensionUri, "dist"), vscode.Uri.joinPath(extensionUri, "media")];
  for (const folder of vscode.workspace.workspaceFolders ?? []) roots.push(folder.uri);
  if (documentUri.scheme !== "untitled" && !vscode.workspace.getWorkspaceFolder(documentUri)) {
    roots.push(vscode.Uri.joinPath(documentUri, ".."));
  }
  return { enableScripts: true, enableCommandUris: false, localResourceRoots: roots };
}

function uiStrings(): UiStrings {
  return {
    modeSource: vscode.l10n.t("Source"),
    modeBoth: vscode.l10n.t("Side by side"),
    modeTranslation: vscode.l10n.t("Translation"),
    retranslate: vscode.l10n.t("Retranslate"),
    settings: vscode.l10n.t("Settings"),
    retry: vscode.l10n.t("Retry"),
    tokens: vscode.l10n.t("{0} tokens", "{0}"),
    // The webview fills in the placeholders.
    progress: vscode.l10n.t("{0}/{1} translated", "{0}", "{1}"),
    failed: vscode.l10n.t("{0} failed", "{0}"),
    warning: vscode.l10n.t("Check this translation"),
  };
}

function kindOf(unit: Unit): SegmentKind {
  return unit.comment ? "comment" : "markdown";
}

function definedKeys(keys: ReadonlyArray<string | undefined>): string[] {
  return keys.filter((key): key is string => key !== undefined);
}

function sameUpdate(a: RowUpdate | undefined, b: RowUpdate): boolean {
  return a !== undefined && a.status === b.status && a.translationHtml === b.translationHtml && a.message === b.message;
}

/** Masked text as context: placeholders stand for code and links, which are not sent. */
function contextText(masked: string): string {
  return masked.replace(/⟦\d+⟧/g, "").replace(/[ \t]+/g, " ").trim();
}
