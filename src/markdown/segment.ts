import type { Env, MarkdownIt, Token } from "markdown-it";
import { hasTranslatableText, looksLikeTargetLanguage } from "../translate/heuristics";
import { maskInline } from "../translate/mask";
import { findComments, type CommentSlot } from "./codeComments";
import { splitFrontMatter } from "./frontMatter";

/**
 * Splitting a document into rows.
 *
 * A row is one top-level block (paragraph, heading, table, quote, code, ...), or one item of a
 * top-level list. The preview shows each row's source and translation side by side, so rows are
 * the unit of alignment. Within a row, every inline token (a paragraph's text, a table cell, a
 * nested list item) is one translation unit. With comment translation on, so is every comment in
 * the row's fenced code blocks.
 */

export type RowType = "block" | "listItem" | "code" | "html" | "rule" | "frontMatter";

export interface Unit {
  /** Inline Markdown as written. */
  source: string;
  /** `source` with code, URLs and HTML replaced by ⟦n⟧ placeholders. */
  masked: string;
  placeholders: string[];
  /** False when there is nothing to translate: only code, links or images, or already in the target language. */
  translatable: boolean;
  /** A comment in a code block: which of the row's fenced code blocks holds it, and where. Inline Markdown has none. */
  comment?: { block: number; slot: CommentSlot };
  /** The text of a `<summary>` in an HTML block, which the preview folds by. */
  summary?: boolean;
}

export interface Row {
  type: RowType;
  /** Shown once across both columns instead of as source and translation. */
  shared: boolean;
  /** 0-based first line and exclusive end line in the document, front matter included. */
  startLine: number;
  endLine: number;
  /** The row's own Markdown; rendering parses it on its own. */
  source: string;
  units: Unit[];
  /** List items: the item's number in an ordered list. */
  orderedStart?: number;
  /** List items: whether the list is tight (items rendered without `<p>`). */
  tight?: boolean;
  classes: string[];
}

export interface SegmentedDocument {
  rows: Row[];
  /** Parser environment with the document's link reference definitions. */
  env: Env;
}

export interface SegmentOptions {
  targetLanguage: string;
  /** Also translate the comments in fenced code blocks. */
  translateCodeComments?: boolean;
}

interface Context {
  md: MarkdownIt;
  env: Env;
  lines: string[];
  lineOffset: number;
  referenceLabels: ReadonlySet<string>;
  targetLanguage: string;
  translateCodeComments: boolean;
}

const COMMENT_RE = /<!--[\s\S]*?-->/g;
const DETAILS_OPEN_RE = /^\s*<details(?=[\s>])([^>]*)>/i;
const DETAILS_CLOSE_RE = /<\/details\s*>/i;
const OPEN_ATTRIBUTE_RE = /(?:^|\s)open(?:[\s=]|$)/i;
/** The text of a `<summary>`; also used to find it again when rendering. */
export const SUMMARY_RE = /(<summary(?=[\s>])[^>]*>)([\s\S]*?)(<\/summary\s*>)/i;

export function segmentDocument(md: MarkdownIt, text: string, options: SegmentOptions): SegmentedDocument {
  const { frontMatter, body, bodyLineOffset } = splitFrontMatter(text.replace(/\r\n?/g, "\n"));
  const rows: Row[] = [];
  if (frontMatter) {
    rows.push({
      type: "frontMatter",
      shared: true,
      startLine: 0,
      endLine: frontMatter.lineCount,
      source: frontMatter.raw,
      units: [],
      classes: ["kind-front-matter"],
    });
  }

  const env: Env = {};
  const tokens = md.parse(body, env);
  const context: Context = {
    md,
    env,
    lines: body.split("\n"),
    lineOffset: bodyLineOffset,
    referenceLabels: new Set(Object.keys(env.references ?? {})),
    targetLanguage: options.targetLanguage,
    translateCodeComments: options.translateCodeComments ?? false,
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const close = token.nesting === 1 ? findClose(tokens, i) : i;
    if (token.type === "bullet_list_open" || token.type === "ordered_list_open") {
      rows.push(...listRows(context, tokens, i, close));
    } else if (token.map) {
      const row = createRow(context, rowTypeOf(token.type), token.map, [`kind-${kindOf(token.type)}`]);
      if (row) rows.push(row);
    }
    i = close;
  }
  return { rows, env };
}

/** Copy of the environment that parsing may modify without affecting the document's. */
export function forkEnv(env: Env): Env {
  return { references: { ...env.references } };
}

/** Inline tokens that carry text, in order. Segmentation and rendering must agree on this list. */
export function inlineTokensOf(tokens: readonly Token[]): Token[] {
  return tokens.filter((token) => token.type === "inline" && token.content.trim() !== "");
}

/** Fenced code blocks, in order, also inside lists and quotes. A comment unit's `block` indexes this list. */
export function fencesOf(tokens: readonly Token[]): Token[] {
  return tokens.filter((token) => token.type === "fence");
}

function listRows(context: Context, tokens: readonly Token[], open: number, close: number): Row[] {
  const list = tokens[open]!;
  const ordered = list.type === "ordered_list_open";
  const start = ordered ? Number(list.attrGet("start") ?? 1) : 1;
  const itemLevel = list.level + 1;
  const tight = tokens
    .slice(open + 1, close)
    .every((token) => token.type !== "paragraph_open" || token.level !== itemLevel + 1 || token.hidden);

  const items: Token[] = [];
  for (let j = open + 1; j < close; j++) {
    const token = tokens[j]!;
    if (token.type === "list_item_open" && token.level === itemLevel) {
      items.push(token);
      j = findClose(tokens, j);
    }
  }

  const rows: Row[] = [];
  items.forEach((item, k) => {
    if (!item.map) return;
    const classes = ["kind-list-item", ordered ? "ordered" : "bullet"];
    if (k === 0) classes.push("list-first");
    if (k === items.length - 1) classes.push("list-last");
    const row = createRow(context, "listItem", item.map, classes);
    if (!row) return;
    row.tight = tight;
    if (ordered) row.orderedStart = start + k;
    rows.push(row);
  });
  return rows;
}

function createRow(context: Context, type: RowType, map: readonly [number, number], classes: string[]): Row | undefined {
  const [first, rawEnd] = map;
  let end = rawEnd;
  while (end > first && context.lines[end - 1]!.trim() === "") end--;
  if (end <= first) return undefined;
  const source = context.lines.slice(first, end).join("\n");
  if (type === "html" && source.replace(COMMENT_RE, "").trim() === "") return undefined;

  const hasUnits = type === "block" || type === "listItem" || (type === "code" && context.translateCodeComments);
  const units = hasUnits ? unitsOf(context, source) : type === "html" ? summaryUnits(context, source, classes) : [];
  return {
    type,
    shared: units.every((unit) => !unit.translatable),
    startLine: context.lineOffset + first,
    endLine: context.lineOffset + end,
    source,
    units,
    classes,
  };
}

function unitsOf(context: Context, source: string): Unit[] {
  const tokens = context.md.parse(source, forkEnv(context.env));
  const units = inlineTokensOf(tokens).map((token) => textUnit(context, token.content, false));
  if (context.translateCodeComments) {
    fencesOf(tokens).forEach((fence, block) => {
      for (const comment of findComments(fence.content, fence.info)) {
        const unit = textUnit(context, comment.text, true);
        // Comments with nothing to translate are left out: the code is shown as written around them.
        if (unit.translatable) units.push({ ...unit, comment: { block, slot: comment.slot } });
      }
    });
  }
  return units;
}

/**
 * `<details>` blocks: the opening row is marked so the preview can fold the rows up to the closing
 * one, and the text of its `<summary>` is translated.
 */
function summaryUnits(context: Context, source: string, classes: string[]): Unit[] {
  const open = DETAILS_OPEN_RE.exec(source);
  if (open && !DETAILS_CLOSE_RE.test(source)) {
    classes.push("details-open");
    if (OPEN_ATTRIBUTE_RE.test(open[1]!)) classes.push("details-start-open");
  } else if (!open && source.replace(COMMENT_RE, "").trim().replace(DETAILS_CLOSE_RE, "") === "") {
    classes.push("details-close");
  }
  const summary = SUMMARY_RE.exec(source);
  const text = summary?.[2]!.trim();
  if (!text) return [];
  const unit = textUnit(context, text, false);
  return unit.translatable ? [{ ...unit, summary: true }] : [];
}

function textUnit(context: Context, source: string, plainText: boolean): Unit {
  const { masked, placeholders } = maskInline(source, {
    // A bracketed word in a comment is not a link.
    referenceLabels: plainText ? undefined : context.referenceLabels,
    normalizeLabel: context.md.utils.normalizeReference,
    plainText,
  });
  const translatable = hasTranslatableText(masked) && !looksLikeTargetLanguage(masked, context.targetLanguage);
  return { source, masked, placeholders, translatable };
}

function findClose(tokens: readonly Token[], open: number): number {
  let depth = 0;
  for (let j = open; j < tokens.length; j++) {
    depth += tokens[j]!.nesting;
    if (depth === 0) return j;
  }
  return tokens.length - 1;
}

function rowTypeOf(tokenType: string): RowType {
  switch (tokenType) {
    case "fence":
    case "code_block":
      return "code";
    case "html_block":
      return "html";
    case "hr":
      return "rule";
    default:
      return "block";
  }
}

function kindOf(tokenType: string): string {
  return tokenType.replace(/_open$/, "").replace(/_/g, "-");
}
