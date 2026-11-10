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

/** Mermaid's browser bundle, which sets `window.mermaid`. */
interface MermaidApi {
  initialize(config: Record<string, unknown>): void;
  run(options: { nodes: HTMLElement[]; suppressErrors?: boolean }): Promise<void>;
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
/** Scripts added later need the page's nonce to pass the content security policy. */
const scriptNonce = (document.currentScript as HTMLScriptElement | null)?.nonce ?? "";

let mode: ViewMode = restoredMode() ?? init.mode;
let version = 0;
let views: RowView[] = [];
let suppressScrollUntil = 0;
let scrollFrame = 0;
let lastSentLine = -1;
/** Whether each `<details>` row is open, by its line, kept across renders. */
const detailsOpen = new Map<number, boolean>();
let mermaidLoad: Promise<MermaidApi | undefined> | undefined;
let diagrams: Promise<void> = Promise.resolve();

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
      applyFolding();
      showProgress(message.progress);
      showNotice(message.notice);
      drawDiagrams();
      break;
    case "updateRows":
      if (message.version !== version) return;
      for (const update of message.rows) {
        const view = views[update.index];
        if (view) showTranslation(view, update);
      }
      showProgress(message.progress);
      drawDiagrams();
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
  if (progress.tokens) parts.push(strings.tokens.replace("{0}", progress.tokens.toLocaleString(init.lang)));
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
  const summary = target?.closest(".row.details-open summary");
  if (summary && !target?.closest("a")) {
    event.preventDefault();
    const view = views.find((candidate) => candidate.el.contains(summary));
    if (view) toggleDetails(view);
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

/**
 * `<details>` spans several rows: the opening row, the rows of its content, and the closing row.
 * The browser cannot fold across rows, so the rows inside a closed one are hidden here.
 */
function applyFolding(): void {
  const stack: boolean[] = [];
  for (const view of views) {
    const classes = view.el.classList;
    const hidden = stack.includes(false);
    if (classes.contains("details-open")) {
      const open = detailsOpen.get(view.line) ?? classes.contains("details-start-open");
      for (const details of view.el.querySelectorAll("details")) details.open = open;
      setFolded(view, hidden, stack.length > 0);
      stack.push(open);
    } else if (classes.contains("details-close") && stack.length > 0) {
      setFolded(view, hidden, true);
      stack.pop();
    } else {
      setFolded(view, hidden, stack.length > 0);
    }
  }
}

function setFolded(view: RowView, folded: boolean, inside: boolean): void {
  view.el.classList.toggle("folded", folded);
  view.el.classList.toggle("in-details", inside);
}

function toggleDetails(view: RowView): void {
  const anchor = currentLine();
  const open = !(detailsOpen.get(view.line) ?? view.el.classList.contains("details-start-open"));
  detailsOpen.set(view.line, open);
  applyFolding();
  if (anchor !== undefined && !open) scrollToLine(Math.min(anchor, view.line));
}

/** Rows on the page now; folded rows have no position to scroll to. */
function shownViews(): RowView[] {
  return views.filter((view) => !view.el.classList.contains("folded"));
}

/** Draws the Mermaid diagrams that are not drawn yet, loading Mermaid the first time one appears. */
function drawDiagrams(): void {
  if (!document.querySelector("pre.mermaid:not([data-processed])")) return;
  diagrams = diagrams.then(async () => {
    const mermaid = await loadMermaid();
    const nodes = [...document.querySelectorAll<HTMLElement>("pre.mermaid:not([data-processed])")];
    if (!mermaid || nodes.length === 0) return;
    try {
      await mermaid.run({ nodes, suppressErrors: true });
    } catch {
      // A diagram that fails to parse stays as its source.
    }
  });
}

function loadMermaid(): Promise<MermaidApi | undefined> {
  mermaidLoad ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.nonce = scriptNonce;
    script.src = init.mermaidScriptUri;
    script.addEventListener("load", () => {
      const mermaid = (window as unknown as { mermaid?: MermaidApi }).mermaid;
      const body = document.body.classList;
      const dark = body.contains("vscode-dark") || (body.contains("vscode-high-contrast") && !body.contains("vscode-high-contrast-light"));
      mermaid?.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "default" });
      resolve(mermaid);
    });
    script.addEventListener("error", () => resolve(undefined));
    document.head.append(script);
  });
  return mermaidLoad;
}

/** Document line at the top of the viewport, interpolated within the row there. */
function currentLine(): number | undefined {
  const views = shownViews();
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
  const views = shownViews();
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
