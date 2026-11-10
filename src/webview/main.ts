import DOMPurify from "dompurify";
import {
  VIEW_MODES,
  isViewMode,
  type EditableUnit,
  type HostAction,
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
  /** The last translation state from the host, shown again when editing ends. */
  last?: RowUpdate | RowPayload;
  /** The translation cell holds the editor; updates wait until it closes. */
  editing: boolean;
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
const modelButton = document.createElement("button");

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
    case "editRow": {
      const view = views[message.index];
      if (message.version === version && view) openEditor(view, message.units);
      break;
    }
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
  modelButton.type = "button";
  modelButton.className = "model";
  modelButton.addEventListener("click", () => api.postMessage({ type: "action", action: "chooseModel" }));
  const spacer = document.createElement("span");
  spacer.className = "spacer";
  toolbar.append(
    group,
    progressEl,
    modelButton,
    spacer,
    toolButton("⤓", strings.exportTranslation, "exportTranslation"),
    toolButton("↻", strings.retranslate, "retranslate"),
    toolButton("⚙", strings.settings, "openSettings"),
  );
}

function toolButton(icon: string, label: string, action: HostAction): HTMLButtonElement {
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
    // Row numbers may now point at other rows: an open editor would save into the wrong one.
    if (view.editing) closeEditor(view);
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
  return { el, source, translation, index: 0, line: 0, endLine: 0, sourceHtml: "", translationState: "", editing: false };
}

function showTranslation(view: RowView, update: RowUpdate | RowPayload): void {
  view.last = update;
  if (view.editing) return;
  const state = JSON.stringify([
    update.status,
    update.translationHtml ?? null,
    update.message ?? null,
    update.edited ?? false,
    view.endLine - view.line,
  ]);
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
      cell.append(content(update.translationHtml), flag("warning", strings.warning, strings.retry, update.message), editTools(update.edited));
      return;
    case "done":
      cell.append(content(update.translationHtml), editTools(update.edited));
      return;
  }
}

/** The edit button, and for an edited translation a badge and a way back to the machine translation. */
function editTools(edited: boolean | undefined): HTMLElement {
  const div = document.createElement("div");
  div.className = "edit-tools";
  if (edited) {
    const badge = document.createElement("span");
    badge.className = "edited-badge";
    badge.textContent = strings.edited;
    const revert = document.createElement("button");
    revert.type = "button";
    revert.className = "link-button revert-row";
    revert.textContent = strings.revert;
    div.append(badge, revert);
  }
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "edit-row";
  edit.textContent = "✎";
  edit.title = strings.edit;
  edit.setAttribute("aria-label", strings.edit);
  div.append(edit);
  return div;
}

function openEditor(view: RowView, units: readonly EditableUnit[]): void {
  view.editing = true;
  view.el.classList.add("editing");
  const form = document.createElement("form");
  form.className = "editor";
  const fields = units.map((unit) => {
    const label = document.createElement("label");
    label.className = "edit-unit";
    const source = document.createElement("span");
    source.className = "edit-source";
    source.textContent = unit.source;
    const field = document.createElement("textarea");
    field.value = unit.text;
    field.rows = Math.min(12, Math.max(2, Math.ceil(unit.text.length / 60) + unit.text.split("\n").length - 1));
    field.spellcheck = false;
    label.append(source, field);
    form.append(label);
    return field;
  });
  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = strings.save;
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "secondary";
  cancel.textContent = strings.cancel;
  cancel.addEventListener("click", () => closeEditor(view));
  const actions = document.createElement("div");
  actions.className = "edit-actions";
  actions.append(save, cancel);
  form.append(actions);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    api.postMessage({ type: "saveRow", index: view.index, texts: fields.map((field) => field.value) });
    closeEditor(view);
  });
  form.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeEditor(view);
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  view.translation.replaceChildren(form);
  fields[0]?.focus();
}

/** Shows the translation again; after a save the host sends the new one. */
function closeEditor(view: RowView): void {
  view.editing = false;
  view.el.classList.remove("editing");
  view.translationState = "";
  if (view.last) showTranslation(view, view.last);
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
  progressEl.textContent = parts.join(" · ");
  progressEl.title = progressEl.textContent;
  modelButton.textContent = progress.label;
  modelButton.title = `${strings.chooseModel}: ${progress.label}`;
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
  const rowIndex = Number(target?.closest<HTMLElement>(".row")?.dataset.index);
  const rowAction = target?.closest(".retry-row, .edit-row, .revert-row");
  if (rowAction) {
    if (!Number.isInteger(rowIndex)) return;
    if (rowAction.classList.contains("retry-row")) api.postMessage({ type: "retryRow", index: rowIndex });
    else if (rowAction.classList.contains("edit-row")) api.postMessage({ type: "editRow", index: rowIndex });
    else api.postMessage({ type: "revertRow", index: rowIndex });
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
