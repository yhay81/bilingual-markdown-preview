import * as vscode from "vscode";

/** How long a scroll of the editor is taken as the echo of scrolling it from the preview. */
const SCROLL_ECHO_MS = 300;

export interface ScrollTarget {
  /** The document whose editors to follow, as a URI string. */
  readonly uri: string;
  /** Tells the translation queue which line the user is looking at, so it translates there first. */
  setFocus(line: number): void;
  /** Whether the editor and the preview scroll together: the `syncScroll` setting. */
  enabled(): boolean;
  /** Scrolls the preview to a line of the document. */
  scrollPreview(line: number): void;
}

/** Keeps the editor and the preview at the same line, and the translation queue's focus there too. */
export class ScrollSync implements vscode.Disposable {
  private ignoreEditorScrollUntil = 0;
  private readonly subscription: vscode.Disposable;

  constructor(private readonly target: ScrollTarget) {
    this.subscription = vscode.window.onDidChangeTextEditorVisibleRanges((event) => this.onEditorScroll(event));
  }

  /** The preview was scrolled to `line`: scrolls the editor there. */
  onPreviewScroll(line: number): void {
    this.target.setFocus(Math.floor(line));
    if (!this.target.enabled()) return;
    const editor = this.editor();
    if (!editor) return;
    // Revealing scrolls the editor, which would scroll the preview back; ignore that echo.
    this.ignoreEditorScrollUntil = Date.now() + SCROLL_ECHO_MS;
    const target = Math.max(0, Math.min(editor.document.lineCount - 1, Math.floor(line)));
    editor.revealRange(new vscode.Range(target, 0, target, 0), vscode.TextEditorRevealType.AtTop);
  }

  /** Scrolls a newly shown preview to where the editor is. */
  syncToEditor(): void {
    const line = this.editor()?.visibleRanges[0]?.start.line;
    if (line === undefined) return;
    this.target.setFocus(line);
    if (this.target.enabled() && line > 0) this.target.scrollPreview(line);
  }

  dispose(): void {
    this.subscription.dispose();
  }

  private onEditorScroll(event: vscode.TextEditorVisibleRangesChangeEvent): void {
    if (event.textEditor.document.uri.toString() !== this.target.uri) return;
    const line = event.visibleRanges[0]?.start.line;
    if (line === undefined) return;
    this.target.setFocus(line);
    if (!this.target.enabled() || Date.now() < this.ignoreEditorScrollUntil) return;
    this.target.scrollPreview(line);
  }

  private editor(): vscode.TextEditor | undefined {
    return vscode.window.visibleTextEditors.find((candidate) => candidate.document.uri.toString() === this.target.uri);
  }
}
