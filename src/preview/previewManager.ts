import * as vscode from "vscode";
import { isViewMode, type ViewMode, type WebviewState } from "../shared/protocol";
import { TranslationPreview, VIEW_TYPE, titleOf, webviewOptions, type PreviewContext } from "./previewPanel";

export interface ManagerContext extends PreviewContext {
  defaultMode(): ViewMode;
}

/** One preview per document; also restores previews after VS Code restarts. */
export class PreviewManager implements vscode.WebviewPanelSerializer, vscode.Disposable {
  private readonly previews = new Map<string, TranslationPreview>();
  private active: TranslationPreview | undefined;

  constructor(private readonly context: ManagerContext) {}

  get activePreview(): TranslationPreview | undefined {
    return this.active?.panel.active ? this.active : undefined;
  }

  previewFor(uri: vscode.Uri): TranslationPreview | undefined {
    return this.previews.get(uri.toString());
  }

  show(document: vscode.TextDocument, column: vscode.ViewColumn, preserveFocus: boolean): void {
    const existing = this.previews.get(document.uri.toString());
    if (existing) {
      existing.reveal(column, preserveFocus);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      VIEW_TYPE,
      titleOf(document),
      { viewColumn: column, preserveFocus },
      { ...webviewOptions(this.context.extensionUri, document.uri), enableFindWidget: true, retainContextWhenHidden: false },
    );
    this.attach(panel, document, this.context.defaultMode());
  }

  async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: unknown): Promise<void> {
    const saved = isWebviewState(state) ? state : undefined;
    if (!saved) {
      panel.dispose();
      return;
    }
    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(saved.documentUri, true));
      const existing = this.previews.get(document.uri.toString());
      if (existing) {
        panel.dispose();
        return;
      }
      this.attach(panel, document, saved.mode);
    } catch {
      panel.dispose();
    }
  }

  refreshAll(): void {
    for (const preview of this.previews.values()) preview.refresh();
  }

  dispose(): void {
    for (const preview of [...this.previews.values()]) preview.dispose();
    this.previews.clear();
  }

  private attach(panel: vscode.WebviewPanel, document: vscode.TextDocument, mode: ViewMode): void {
    const preview = new TranslationPreview(panel, document, mode, this.context);
    const key = document.uri.toString();
    this.previews.set(key, preview);
    this.setActive(preview);
    preview.onDidBecomeActive(() => this.setActive(preview));
    preview.onDidDispose(() => {
      if (this.previews.get(key) === preview) this.previews.delete(key);
      if (this.active === preview) {
        this.active = undefined;
        this.context.service.setActiveOwner(undefined);
      }
    });
  }

  private setActive(preview: TranslationPreview): void {
    this.active = preview;
    this.context.service.setActiveOwner(preview.owner);
  }
}

function isWebviewState(value: unknown): value is WebviewState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  return typeof state.documentUri === "string" && isViewMode(state.mode);
}
