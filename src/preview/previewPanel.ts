import type { MarkdownIt } from "markdown-it";
import * as vscode from "vscode";
import type { RowRenderer } from "../markdown/render";
import type { ExtensionConfig } from "../settings";
import { parseWebviewMessage, type HostAction, type HostToWebview, type Notice, type RowUpdate, type ViewMode } from "../shared/protocol";
import type { TranslationCache } from "../translate/cache";
import type { ServiceChange, TranslationService } from "../translate/service";
import { buildWebviewHtml, webviewOptions } from "./html";
import { openLink } from "./links";
import { noticeFor } from "./notices";
import { PreviewDocument, type DocumentContext } from "./previewDocument";
import { saveTranslation } from "./saveTranslation";
import { ScrollSync } from "./scrollSync";

export const VIEW_TYPE = "markdownTranslation.preview";

const RENDER_DELAY_MS = 200;
const TRANSLATE_DELAY_MS = 1000;
const FLUSH_DELAY_MS = 80;

export interface PreviewContext {
  extensionUri: vscode.Uri;
  md: MarkdownIt;
  renderer: RowRenderer;
  service: TranslationService;
  /** The user's own edits of translations, by translation key, with code and links restored. */
  edits: TranslationCache;
  getConfig(): ExtensionConfig;
  /** Runs actions the preview cannot handle itself, such as setting the API key. */
  runAction(action: HostAction): void;
  onModeChanged(mode: ViewMode): void;
}

let nextOwner = 1;

/**
 * One preview panel showing one Markdown document with its translation. It keeps the webview up to
 * date with the document and the translation queue; `PreviewDocument` decides what each row shows.
 */
export class TranslationPreview implements vscode.Disposable {
  readonly owner = `preview-${nextOwner++}`;
  private document: vscode.TextDocument;
  private ready = false;
  private version = 0;
  private current: PreviewDocument | undefined;
  /** What the webview shows for each row of `current`, to send only real changes. */
  private sent: Array<RowUpdate | undefined> = [];
  private readonly dirtyRows = new Set<number>();
  private renderTimer: ReturnType<typeof setTimeout> | undefined;
  private translateTimer: ReturnType<typeof setTimeout> | undefined;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private lastNotice = "";
  private disposed = false;
  private readonly documentContext: DocumentContext;
  private readonly scroll: ScrollSync;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly disposeEmitter = new vscode.EventEmitter<void>();
  private readonly activeEmitter = new vscode.EventEmitter<void>();
  readonly onDidDispose = this.disposeEmitter.event;
  readonly onDidBecomeActive = this.activeEmitter.event;

  constructor(
    readonly panel: vscode.WebviewPanel,
    document: vscode.TextDocument,
    mode: ViewMode,
    private readonly context: PreviewContext,
  ) {
    this.document = document;
    this.documentContext = { md: context.md, renderer: context.renderer, service: context.service, edits: context.edits, l10n: vscode.l10n };
    this.scroll = new ScrollSync({
      uri: document.uri.toString(),
      setFocus: (line) => context.service.setFocus(this.owner, line),
      enabled: () => context.getConfig().syncScroll,
      scrollPreview: (line) => this.post({ type: "scrollToLine", line }),
    });
    panel.title = titleOf(document);
    panel.webview.options = webviewOptions(context.extensionUri, document.uri);
    panel.webview.html = buildWebviewHtml(panel.webview, context.extensionUri, document.uri, mode);

    this.disposables.push(
      this.scroll,
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
      context.service.onDidChange((change) => this.onServiceChange(change)),
    );
  }

  get uri(): string {
    return this.document.uri.toString();
  }

  /** The language the document's front matter chooses with `translate-to`, if any. */
  get documentLanguage(): string | undefined {
    return this.current?.documentLanguage;
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

  /** Translates the whole document again, ignoring cached translations. The user's edits stay. */
  retranslate(): void {
    if (this.current) this.context.service.forget(this.current.keys());
    this.render(true);
  }

  /** Writes the translated Markdown to a file, by default `README.ja.md` beside `README.md`. */
  async exportTranslation(target?: vscode.Uri): Promise<vscode.Uri | undefined> {
    const current = this.current ?? this.prepare();
    return saveTranslation(this.document, current.exportMarkdown(this.document.getText()), current.targetLanguage, target);
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

  private onMessage(raw: unknown): void {
    const message = parseWebviewMessage(raw);
    if (!message) return;
    switch (message.type) {
      case "ready":
        this.ready = true;
        this.render(true);
        this.scroll.syncToEditor();
        break;
      case "openLink":
        void openLink(message.href, this.document.uri);
        break;
      case "visibleLine":
        this.scroll.onPreviewScroll(message.line);
        break;
      case "retryRow":
        if (this.current) this.context.service.retry(this.current.rowKeys(message.index));
        break;
      case "action":
        this.onAction(message.action);
        break;
      case "modeChanged":
        this.context.onModeChanged(message.mode);
        break;
      case "editRow":
        this.offerEdit(message.index);
        break;
      case "saveRow":
        this.saveEdit(message.index, message.texts);
        break;
      case "revertRow":
        this.saveEdit(message.index, undefined);
        break;
    }
  }

  /** Sends the row's translated units to the webview for editing. */
  private offerEdit(index: number): void {
    const current = this.current;
    if (!current) return;
    const units = current.editableUnits(index);
    if (units.length > 0) this.post({ type: "editRow", version: current.version, index, units });
  }

  /** Stores the user's texts for the row's translated units, or removes them when `texts` is undefined. */
  private saveEdit(index: number, texts: readonly string[] | undefined): void {
    const current = this.current;
    if (!current) return;
    const changes = current.editsFor(index, texts);
    if (changes.length === 0) return;
    for (const { key, text } of changes) {
      if (text === undefined) this.context.edits.delete([key]);
      else this.context.edits.set(key, text);
    }
    for (const row of current.rowsWith(changes.map(({ key }) => key))) this.dirtyRows.add(row);
    this.flush();
  }

  private onAction(action: HostAction): void {
    switch (action) {
      case "retranslate":
        this.retranslate();
        break;
      case "resume":
        this.context.service.resume();
        break;
      case "exportTranslation":
        void this.exportTranslation();
        break;
      case "retryFailed":
        if (this.current) this.context.service.retry(this.current.failedKeys());
        break;
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
    const current = this.prepare();
    this.current = current;
    this.dirtyRows.clear();
    this.sent = [];
    const rows = Array.from({ length: current.rowCount }, (_, index) => {
      const state = current.rowState(index);
      this.sent[index] = state;
      return current.rowPayload(index, state);
    });
    const progress = current.progress();
    const notice = this.notice(progress.failed);
    this.lastNotice = JSON.stringify(notice);
    this.post({ type: "render", version: current.version, rows, progress, notice });
    if (requestNow) this.requestTranslations();
    else this.schedule("translate");
  }

  private prepare(): PreviewDocument {
    return new PreviewDocument(this.documentContext, {
      version: ++this.version,
      text: this.document.getText(),
      config: this.context.getConfig(),
      trusted: vscode.workspace.isTrusted,
    });
  }

  private requestTranslations(): void {
    clearTimeout(this.translateTimer);
    if (!this.current || this.disposed) return;
    this.context.service.request(this.owner, this.current.jobs());
  }

  private notice(failed: number): Notice | null {
    const service = this.context.service;
    return noticeFor({ config: this.context.getConfig(), block: service.getBlock(), failed, lastError: service.getLastError() }, vscode.l10n);
  }

  private onServiceChange(change: ServiceChange): void {
    const current = this.current;
    if (!current || !this.ready) return;
    for (const index of current.rowsWith(change.keys)) this.dirtyRows.add(index);
    if (this.dirtyRows.size > 0 || change.stateChanged) {
      this.flushTimer ??= setTimeout(() => this.flush(), FLUSH_DELAY_MS);
    }
  }

  private flush(): void {
    this.flushTimer = undefined;
    const current = this.current;
    if (!current || !this.ready || this.disposed) return;
    const updates: RowUpdate[] = [];
    for (const index of this.dirtyRows) {
      if (index >= current.rowCount) continue;
      const state = current.rowState(index);
      if (sameUpdate(this.sent[index], state)) continue;
      this.sent[index] = state;
      updates.push(state);
    }
    this.dirtyRows.clear();
    const progress = current.progress();
    this.post({ type: "updateRows", version: current.version, rows: updates, progress });
    const notice = this.notice(progress.failed);
    const serialized = JSON.stringify(notice);
    if (serialized !== this.lastNotice) {
      this.lastNotice = serialized;
      this.post({ type: "notice", notice });
    }
  }

  private post(message: HostToWebview): void {
    if (this.ready && !this.disposed) void this.panel.webview.postMessage(message);
  }
}

export function titleOf(document: vscode.TextDocument): string {
  const name = document.uri.path.split("/").pop() || document.fileName;
  return vscode.l10n.t("Translation: {0}", name);
}

function sameUpdate(a: RowUpdate | undefined, b: RowUpdate): boolean {
  return (
    a !== undefined &&
    a.status === b.status &&
    a.translationHtml === b.translationHtml &&
    a.message === b.message &&
    a.edited === b.edited
  );
}
