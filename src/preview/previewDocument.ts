import type { MarkdownIt } from "markdown-it";
import { exportTranslation, type ExportResult } from "../markdown/export";
import { documentTargetLanguage } from "../markdown/frontMatter";
import type { RowRenderer } from "../markdown/render";
import { segmentDocument, type Row, type SegmentedDocument, type Unit } from "../markdown/segment";
import { Slugger } from "../markdown/slug";
import type { TokenUsage } from "../providers/types";
import { fingerprintOf, modelLabelOf, type ExtensionConfig } from "../settings";
import type { EditableUnit, ProgressInfo, RowPayload, RowUpdate } from "../shared/protocol";
import { translationKey } from "../translate/keys";
import { unmask } from "../translate/mask";
import type { SegmentKind } from "../translate/prompt";
import type { TranslationJob, TranslationResult } from "../translate/service";
import type { L10n } from "./l10n";

/** What a document needs to be rendered and to know its translations. No VS Code, so tests can use it. */
export interface DocumentContext {
  md: MarkdownIt;
  renderer: RowRenderer;
  /** The translation queue's results. */
  service: {
    getResult(key: string): TranslationResult | undefined;
    getUsage(): TokenUsage;
  };
  /** The user's own edits of translations, by translation key, with code and links restored. */
  edits: { get(key: string): string | undefined };
  l10n: L10n;
}

export interface DocumentInput {
  /** Increases with every render, so the webview can ignore messages about an older one. */
  version: number;
  text: string;
  config: ExtensionConfig;
  /** Like the target language setting, the document's own choice counts only in a trusted workspace. */
  trusted: boolean;
}

/** A change to the user's edits: `text` undefined removes the edit. */
export interface EditChange {
  key: string;
  text: string | undefined;
}

interface PreparedRow {
  row: Row;
  sourceHtml: string;
  /** Translation key per unit, or undefined for units that are shown as written. */
  keys: Array<string | undefined>;
}

/** Characters of preceding text sent with a request, so terms and tone carry over between requests. */
const CONTEXT_CHARS = 400;

/** One render of a Markdown document: its rows, their translation keys, and what to show for each. */
export class PreviewDocument {
  readonly version: number;
  readonly doc: SegmentedDocument;
  /** Set when the document's front matter chooses the language; otherwise the configured one is used. */
  readonly documentLanguage: string | undefined;
  readonly targetLanguage: string;
  readonly modelLabel: string;
  private readonly rows: PreparedRow[];
  /** Rows containing each key. Its size is the number of distinct segments to translate. */
  private readonly rowsByKey = new Map<string, number[]>();

  constructor(
    private readonly context: DocumentContext,
    input: DocumentInput,
  ) {
    const { config, text } = input;
    this.version = input.version;
    this.documentLanguage = input.trusted ? documentTargetLanguage(text) : undefined;
    this.targetLanguage = this.documentLanguage ?? config.targetLanguage;
    this.modelLabel = modelLabelOf(config);
    const fingerprint = fingerprintOf({ ...config, targetLanguage: this.targetLanguage });
    this.doc = segmentDocument(context.md, text, {
      targetLanguage: this.targetLanguage,
      translateCodeComments: config.translateCodeComments,
    });
    const slugger = new Slugger();
    this.rows = this.doc.rows.map((row, index): PreparedRow => {
      const keys = row.shared
        ? []
        : row.units.map((unit) => (unit.translatable ? translationKey(fingerprint, unit.masked, unit.placeholders, kindOf(unit)) : undefined));
      for (const key of definedKeys(keys)) {
        const indexes = this.rowsByKey.get(key);
        if (!indexes) this.rowsByKey.set(key, [index]);
        else if (indexes.at(-1) !== index) indexes.push(index);
      }
      return { row, sourceHtml: context.renderer.renderSource(row, this.doc.env, slugger), keys };
    });
  }

  get rowCount(): number {
    return this.rows.length;
  }

  /** Every translation key in the document, once each. */
  keys(): IterableIterator<string> {
    return this.rowsByKey.keys();
  }

  /** The translation keys of one row. */
  rowKeys(index: number): string[] {
    return definedKeys(this.rows[index]?.keys ?? []);
  }

  /** The rows that contain any of `keys`. */
  rowsWith(keys: Iterable<string>): Set<number> {
    const rows = new Set<number>();
    for (const key of keys) for (const index of this.rowsByKey.get(key) ?? []) rows.add(index);
    return rows;
  }

  /** The keys whose translation failed. */
  failedKeys(): string[] {
    return [...this.rowsByKey.keys()].filter((key) => this.context.service.getResult(key)?.state === "error");
  }

  /** The translation jobs for the whole document, each with the text before it as context. */
  jobs(): TranslationJob[] {
    const jobs: TranslationJob[] = [];
    let before = "";
    for (const { row, keys } of this.rows) {
      row.units.forEach((unit, k) => {
        const key = keys[k];
        if (key) {
          jobs.push({
            key,
            masked: unit.masked,
            placeholders: unit.placeholders,
            line: row.startLine,
            kind: kindOf(unit),
            targetLanguage: this.documentLanguage,
            context: before || undefined,
          });
        }
        if (!unit.comment) before = `${before}\n${contextText(unit.masked)}`.slice(-CONTEXT_CHARS);
      });
    }
    return jobs;
  }

  /** The whole row for the webview, with its translation state from `rowState`. */
  rowPayload(index: number, state: RowUpdate): RowPayload {
    const { row, sourceHtml } = this.rows[index]!;
    return {
      index,
      shared: row.shared,
      line: row.startLine,
      endLine: row.endLine,
      classes: row.classes,
      sourceHtml,
      translationHtml: state.translationHtml,
      status: state.status,
      message: state.message,
      edited: state.edited,
    };
  }

  /** What the row's translation column shows now. */
  rowState(index: number): RowUpdate {
    const entry = this.rows[index]!;
    if (entry.row.shared) return { index, status: "shared" };
    const texts: Array<string | undefined> = [];
    let pending = false;
    let warning = false;
    let edited = false;
    let error: string | undefined;
    entry.row.units.forEach((unit, k) => {
      const key = entry.keys[k];
      const edit = key ? this.context.edits.get(key) : undefined;
      const result = key && edit === undefined ? this.context.service.getResult(key) : undefined;
      if (!key) {
        texts.push(undefined);
      } else if (edit !== undefined) {
        edited = true;
        texts.push(edit);
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
    const translationHtml = this.context.renderer.renderTranslation(entry.row, this.doc.env, texts);
    const state: RowUpdate = warning
      ? { index, status: "warning", translationHtml, message: this.context.l10n.t("This translation may be missing code, links, or formatting.") }
      : { index, status: "done", translationHtml };
    if (edited) state.edited = true;
    return state;
  }

  progress(): ProgressInfo {
    let done = 0;
    let failed = 0;
    for (const key of this.rowsByKey.keys()) {
      const state = this.context.service.getResult(key)?.state;
      if (state === "done") done++;
      else if (state === "error") failed++;
    }
    const usage = this.context.service.getUsage();
    const tokens = usage.inputTokens + usage.outputTokens;
    return { total: this.rowsByKey.size, done, failed, model: this.modelLabel, targetLanguage: this.targetLanguage, ...(tokens > 0 ? { tokens } : {}) };
  }

  /** The text shown for one unit: the user's edit, or the finished translation with code and links restored. */
  translationOf(rowIndex: number, unitIndex: number): string | undefined {
    const entry = this.rows[rowIndex];
    const key = entry?.keys[unitIndex];
    const unit = entry?.row.units[unitIndex];
    if (!key || !unit) return undefined;
    return this.context.edits.get(key) ?? this.machineTranslation(key, unit);
  }

  /** The row's translated units, as the webview's editor shows them. */
  editableUnits(index: number): EditableUnit[] {
    const entry = this.rows[index];
    if (!entry) return [];
    const units: EditableUnit[] = [];
    entry.row.units.forEach((unit, k) => {
      if (entry.keys[k]) units.push({ source: unit.source, text: this.translationOf(index, k) ?? unit.source });
    });
    return units;
  }

  /**
   * How the user's texts for a row's translated units change the stored edits. `texts` undefined
   * reverts the row; a text left empty or equal to the machine translation is no edit either.
   */
  editsFor(index: number, texts: readonly string[] | undefined): EditChange[] {
    const entry = this.rows[index];
    if (!entry) return [];
    const changes: EditChange[] = [];
    let n = 0;
    entry.row.units.forEach((unit, k) => {
      const key = entry.keys[k];
      if (!key) return;
      const text = texts?.[n++];
      const keep = text !== undefined && text.trim() !== "" && text !== this.machineTranslation(key, unit);
      changes.push({ key, text: keep ? text : undefined });
    });
    return changes;
  }

  /** The translated Markdown of `text`, the document as it is now; units not translated yet stay as written. */
  exportMarkdown(text: string): ExportResult {
    return exportTranslation(this.context.md, text, this.doc, (row, unit) => this.translationOf(row, unit));
  }

  private machineTranslation(key: string, unit: Unit): string | undefined {
    const result = this.context.service.getResult(key);
    return result?.state === "done" ? unmask(result.text, unit.placeholders) : undefined;
  }
}

function kindOf(unit: Unit): SegmentKind {
  return unit.comment ? "comment" : "markdown";
}

function definedKeys(keys: ReadonlyArray<string | undefined>): string[] {
  return keys.filter((key): key is string => key !== undefined);
}

/** Masked text as context: placeholders stand for code and links, which are not sent. */
function contextText(masked: string): string {
  return masked.replace(/⟦\d+⟧/g, "").replace(/[ \t]+/g, " ").trim();
}
