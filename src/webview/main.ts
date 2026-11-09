import DOMPurify from "dompurify";
import {
  VIEW_MODES,
  isViewMode,
  type HostToWebview,
  type InitData,
  type Notice,
  type ProgressInfo,
  type RowPayload,
  type RowUpdate,
  type ViewMode,
  type WebviewState,
  type WebviewToHost,
} from "../shared/protocol";

interface VsCodeApi {
  postMessage(message: WebviewToHost): void;
  getState(): unknown;
  setState(state: WebviewState): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

interface RowView {
  el: HTMLElement;
  source: HTMLElement;
  translation: HTMLElement;
  index: number;
  line: number;
  endLine: number;
  sourceHtml: string;
  /** Serialized status, HTML and message currently shown in the translation cell. */
  translationState: string;
}

const PURIFY_CONFIG = {
  FORBID_TAGS: ["style", "form", "base", "meta", "link", "iframe", "frame", "frameset", "object", "embed", "script"],
  ALLOW_DATA_ATTR: false,
};

const api = acquireVsCodeApi();
const init = JSON.parse(document.getElementById("bm-init")?.textContent ?? "{}") as InitData;
const strings = init.strings;
const toolbar = document.getElementById("toolbar")!;
const noticeEl = document.getElementById("notice")!;
const rowsEl = document.getElementById("rows")!;

let mode: ViewMode = restoredMode() ?? init.mode;
let version = 0;
let views: RowView[] = [];
let suppressScrollUntil = 0;
let scrollFrame = 0;
let lastSentLine = -1;

const modeButtons = new Map<ViewMode, HTMLButtonElement>();
const progressEl = document.createElement("span");

buildToolbar();
applyMode(mode, false);
window.addEventListener("message", (event: MessageEvent<HostToWebview>) => onMessage(event.data));
window.addEventListener("scroll", onScroll, { passive: true });
document.addEventListener("click", onClick);
api.postMessage({ type: "ready" });

function onMessage(message: HostToWebview): void {
  switch (message.type) {
    case "render":
      version = message.version;
      renderRows(message.rows);
      showProgress(message.progress);
      showNotice(message.notice);
      break;
    case "updateRows":
      if (message.version !== version) return;
      for (const update of message.rows) {
        const view = views[update.index];
        if (view) showTranslation(view, update);
      }
      showProgress(message.progress);
      break;
    case "notice":
      showNotice(message.notice);
      break;
    case "scrollToLine":
      scrollToLine(message.line);
      break;
  }
}

function buildToolbar(): void {
  const group = document.createElement("div");
  group.className = "modes";
  group.setAttribute("role", "group");
  const labels: Record<ViewMode, string> = { source: strings.modeSource, both: strings.modeBoth, translation: strings.modeTranslation };
  for (const value of VIEW_MODES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = labels[value];
    button.addEventListener("click", () => applyMode(value, true));
    modeButtons.set(value, button);
    group.append(button);
  }
  progressEl.className = "progress";
  const spacer = document.createElement("span");
  spacer.className = "spacer";
  toolbar.append(group, progressEl, spacer, toolButton("↻", strings.retranslate, "retranslate"), toolButton("⚙", strings.settings, "openSettings"));
}

function toolButton(icon: string, label: string, action: "retranslate" | "openSettings"): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tool";
  button.textContent = icon;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", () => api.postMessage({ type: "action", action }));
  return button;
}

function applyMode(next: ViewMode, notify: boolean): void {
  const anchor = notify ? currentLine() : undefined;
  mode = next;
  document.body.dataset.mode = next;
  for (const [value, button] of modeButtons) button.setAttribute("aria-pressed", String(value === next));
  api.setState({ documentUri: init.documentUri, mode: next });
  if (!notify) return;
  api.postMessage({ type: "modeChanged", mode: next });
  // Columns change height; keep the same place in view.
  if (anchor !== undefined) scrollToLine(anchor);
}

function restoredMode(): ViewMode | undefined {
  const state = api.getState() as Partial<WebviewState> | undefined;
  return state && state.documentUri === init.documentUri && isViewMode(state.mode) ? state.mode : undefined;
}

function renderRows(rows: readonly RowPayload[]): void {
  const next: RowView[] = [];
  rows.forEach((payload, i) => {
    const view = views[i] ?? createView();
    view.index = payload.index;
    view.line = payload.line;
    view.endLine = payload.endLine;
    view.el.className = ["row", payload.shared ? "shared" : "pair", ...payload.classes].join(" ");
    view.el.dataset.index = String(payload.index);
    if (view.sourceHtml !== payload.sourceHtml) {
      view.source.innerHTML = sanitize(payload.sourceHtml);
      view.sourceHtml = payload.sourceHtml;
    }
    showTranslation(view, payload);
    if (rowsEl.children[i] !== view.el) rowsEl.insertBefore(view.el, rowsEl.children[i] ?? null);
    next.push(view);
  });
  for (const view of views.slice(rows.length)) view.el.remove();
  views = next;
}

function createView(): RowView {
  const el = document.createElement("section");
  const source = document.createElement("div");
  source.className = "cell source";
  const translation = document.createElement("div");
  translation.className = "cell translation";
  el.append(source, translation);
  return { el, source, translation, index: 0, line: 0, endLine: 0, sourceHtml: "", translationState: "" };
}

function showTranslation(view: RowView, update: RowUpdate | RowPayload): void {
  const state = JSON.stringify([update.status, update.translationHtml ?? null, update.message ?? null, view.endLine - view.line]);
  if (view.translationState === state) return;
  view.translationState = state;
  view.el.dataset.status = update.status;
  const cell = view.translation;
  cell.hidden = update.status === "shared";
  cell.replaceChildren();
  switch (update.status) {
    case "shared":
      return;
    case "translating":
      cell.append(skeleton(view.endLine - view.line));
      return;
    case "error":
      cell.append(flag("error", update.message ?? "", strings.retry));
      return;
    case "warning":
      cell.append(content(update.translationHtml), flag("warning", strings.warning, strings.retry, update.message));
      return;
    case "done":
      cell.append(content(update.translationHtml));
      return;
  }
}

function content(html: string | undefined): HTMLElement {
  const div = document.createElement("div");
  div.className = "content";
  div.innerHTML = sanitize(html ?? "");
  return div;
}

function skeleton(lineCount: number): HTMLElement {
  const div = document.createElement("div");
  div.className = "skeleton";
  div.setAttribute("aria-hidden", "true");
  for (let i = 0; i < Math.min(4, Math.max(1, lineCount)); i++) div.append(document.createElement("span"));
  return div;
}

function flag(kind: "error" | "warning", text: string, retryLabel: string, detail?: string): HTMLElement {
  const div = document.createElement("div");
  div.className = `row-flag ${kind}`;
  const message = document.createElement("span");
  message.className = "message";
  message.textContent = (kind === "error" ? "✕ " : "⚠ ") + text;
  if (detail) message.title = detail;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "link-button retry-row";
  retry.textContent = retryLabel;
  div.append(message, retry);
  return div;
}

function showProgress(progress: ProgressInfo): void {
  const parts: string[] = [];
  if (progress.total > 0) {
    parts.push(strings.progress.replace("{0}", String(progress.done)).replace("{1}", String(progress.total)));
  }
  if (progress.failed > 0) parts.push(strings.failed.replace("{0}", String(progress.failed)));
  parts.push(progress.label);
  progressEl.textContent = parts.join(" · ");
  progressEl.title = progressEl.textContent;
}

function showNotice(notice: Notice | null): void {
  document.body.classList.toggle("paused", notice?.blocking ?? false);
  if (!notice) {
    noticeEl.hidden = true;
    noticeEl.replaceChildren();
    return;
  }
  noticeEl.hidden = false;
  noticeEl.className = `notice ${notice.severity}`;
  const text = document.createElement("span");
  text.className = "message";
  text.textContent = notice.message;
  const actions = notice.actions.map(({ label, action }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => api.postMessage({ type: "action", action }));
    return button;
  });
  noticeEl.replaceChildren(text, ...actions);
}

function onClick(event: MouseEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  const retry = target?.closest(".retry-row");
  if (retry) {
    const index = Number(retry.closest<HTMLElement>(".row")?.dataset.index);
    if (Number.isInteger(index)) api.postMessage({ type: "retryRow", index });
    return;
  }
  const anchor = target?.closest("a");
  const href = anchor?.getAttribute("href");
  if (!href) return;
  event.preventDefault();
  if (href.startsWith("#")) scrollToAnchor(href.slice(1));
  else api.postMessage({ type: "openLink", href });
}

function scrollToAnchor(fragment: string): void {
  let id = fragment;
  try {
    id = decodeURIComponent(fragment);
  } catch {
    // Use the fragment as written.
  }
  const element = document.getElementById(id) ?? document.getElementById(id.toLowerCase());
  if (!element) return;
  // Headings in a hidden column cannot be scrolled to; use their row instead.
  const visible = element.getClientRects().length > 0 ? element : element.closest(".row");
  visible?.scrollIntoView({ block: "start" });
}

function onScroll(): void {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    if (Date.now() < suppressScrollUntil) return;
    const line = currentLine();
    if (line === undefined || Math.abs(line - lastSentLine) < 0.5) return;
    lastSentLine = line;
    api.postMessage({ type: "visibleLine", line });
  });
}

/** Document line at the top of the viewport, interpolated within the row there. */
function currentLine(): number | undefined {
  if (views.length === 0) return undefined;
  const top = toolbar.getBoundingClientRect().bottom;
  let lo = 0;
  let hi = views.length - 1;
  let found = views.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (views[mid]!.el.getBoundingClientRect().bottom > top) {
      found = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  const view = views[found]!;
  const rect = view.el.getBoundingClientRect();
  const fraction = rect.height > 0 ? Math.min(1, Math.max(0, (top - rect.top) / rect.height)) : 0;
  return view.line + fraction * (view.endLine - view.line);
}

function scrollToLine(line: number): void {
  if (views.length === 0) return;
  let lo = 0;
  let hi = views.length - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (views[mid]!.line <= line) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const view = views[found]!;
  const rect = view.el.getBoundingClientRect();
  const span = Math.max(1, view.endLine - view.line);
  const fraction = Math.min(1, Math.max(0, (line - view.line) / span));
  const top = window.scrollY + rect.top + fraction * rect.height - toolbar.getBoundingClientRect().bottom;
  suppressScrollUntil = Date.now() + 250;
  lastSentLine = line;
  window.scrollTo({ top: Math.max(0, top) });
}

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}
