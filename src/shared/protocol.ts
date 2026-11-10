/**
 * Messages exchanged between the extension host and the preview webview.
 * Both sides import this file, so it must not depend on `vscode`, Node, or the DOM.
 */

export type ViewMode = "both" | "source" | "translation";

export const VIEW_MODES: readonly ViewMode[] = ["source", "both", "translation"];

export type RowStatus = "shared" | "translating" | "done" | "warning" | "error";

export interface RowPayload {
  /** Position of the row in the current render. */
  index: number;
  /** Shared rows (code, HTML, rules, front matter, already-translated text) span both columns. */
  shared: boolean;
  /** 0-based first source line and exclusive end line, in document coordinates. */
  line: number;
  endLine: number;
  /** Extra CSS classes, e.g. the row's position in a list. */
  classes: string[];
  sourceHtml: string;
  /** Rendered translation. Missing while nothing has been translated yet. */
  translationHtml?: string;
  status: RowStatus;
  /** Error or warning detail for the translation. */
  message?: string;
}

export interface RowUpdate {
  index: number;
  translationHtml?: string;
  status: RowStatus;
  message?: string;
}

export interface ProgressInfo {
  /** Distinct segments that need translation. */
  total: number;
  done: number;
  failed: number;
  /** For example "claude-haiku-5-5 → Japanese". */
  label: string;
  /** Tokens used in this session, over all previews, when the API reports them. */
  tokens?: number;
}

export type HostAction = "setApiKey" | "switchProvider" | "openSettings" | "retryFailed" | "retranslate" | "resume";

export const HOST_ACTIONS: readonly HostAction[] = ["setApiKey", "switchProvider", "openSettings", "retryFailed", "retranslate", "resume"];

export interface NoticeAction {
  label: string;
  action: HostAction;
}

export interface Notice {
  severity: "info" | "warning" | "error";
  message: string;
  actions: NoticeAction[];
  /** True while no translation can make progress (for example, no API key). */
  blocking: boolean;
}

export interface UiStrings {
  modeSource: string;
  modeBoth: string;
  modeTranslation: string;
  retranslate: string;
  settings: string;
  retry: string;
  /** Template with {0} = number of tokens. */
  tokens: string;
  /** Template with {0} = done and {1} = total. */
  progress: string;
  /** Template with {0} = number of failed segments. */
  failed: string;
  warning: string;
}

export interface InitData {
  documentUri: string;
  lang: string;
  mode: ViewMode;
  strings: UiStrings;
}

/** What the webview stores with `setState`, so a restored panel can find its document again. */
export interface WebviewState {
  documentUri: string;
  mode: ViewMode;
}

export type HostToWebview =
  | { type: "render"; version: number; rows: RowPayload[]; progress: ProgressInfo; notice: Notice | null }
  | { type: "updateRows"; version: number; rows: RowUpdate[]; progress: ProgressInfo }
  | { type: "notice"; notice: Notice | null }
  | { type: "scrollToLine"; line: number };

export type WebviewToHost =
  | { type: "ready" }
  | { type: "openLink"; href: string }
  | { type: "visibleLine"; line: number }
  | { type: "retryRow"; index: number }
  | { type: "action"; action: HostAction }
  | { type: "modeChanged"; mode: ViewMode };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isViewMode(value: unknown): value is ViewMode {
  return typeof value === "string" && (VIEW_MODES as readonly string[]).includes(value);
}

/** Validates a message from the webview. The webview renders document content, so never trust its shape. */
export function parseWebviewMessage(raw: unknown): WebviewToHost | undefined {
  if (!isRecord(raw) || typeof raw.type !== "string") return undefined;
  switch (raw.type) {
    case "ready":
      return { type: "ready" };
    case "openLink":
      return typeof raw.href === "string" && raw.href.length <= 4096 ? { type: "openLink", href: raw.href } : undefined;
    case "visibleLine":
      return isFiniteNumber(raw.line) && raw.line >= 0 ? { type: "visibleLine", line: raw.line } : undefined;
    case "retryRow":
      return Number.isInteger(raw.index) && (raw.index as number) >= 0 ? { type: "retryRow", index: raw.index as number } : undefined;
    case "action":
      return typeof raw.action === "string" && (HOST_ACTIONS as readonly string[]).includes(raw.action)
        ? { type: "action", action: raw.action as HostAction }
        : undefined;
    case "modeChanged":
      return isViewMode(raw.mode) ? { type: "modeChanged", mode: raw.mode } : undefined;
    default:
      return undefined;
  }
}
