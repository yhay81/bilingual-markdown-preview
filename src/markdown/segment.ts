import type { Env, MarkdownIt, Token } from "markdown-it";
import { hasTranslatableText, looksLikeTargetLanguage } from "../translate/heuristics";
import { maskInline } from "../translate/mask";
import { splitFrontMatter } from "./frontMatter";

/**
 * Splitting a document into rows.
 *
 * A row is one top-level block (paragraph, heading, table, quote, code, ...), or one item of a
 * top-level list. The preview shows each row's source and translation side by side, so rows are
 * the unit of alignment. Within a row, every inline token (a paragraph's text, a table cell, a
 * nested list item) is one translation unit.
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
}

interface Context {
  md: MarkdownIt;
  env: Env;
  lines: string[];
  lineOffset: number;
  referenceLabels: ReadonlySet<string>;
  targetLanguage: string;
}

const COMMENT_RE = /<!--[\s\S]*?-->/g;

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

  const units = type === "block" || type === "listItem" ? unitsOf(context, source) : [];
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
  return inlineTokensOf(tokens).map((token) => {
    const { masked, placeholders } = maskInline(token.content, {
      referenceLabels: context.referenceLabels,
      normalizeLabel: context.md.utils.normalizeReference,
    });
    const translatable = hasTranslatableText(masked) && !looksLikeTargetLanguage(masked, context.targetLanguage);
    return { source: token.content, masked, placeholders, translatable };
  });
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
