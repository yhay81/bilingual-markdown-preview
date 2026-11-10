import type { MarkdownIt } from "markdown-it";
import { spliceComments, type CommentEdit } from "./codeComments";
import { fencesOf, type Row, type SegmentedDocument } from "./segment";

/**
 * Writing the translation out as Markdown.
 *
 * Each row's source is copied with the text of its translated units replaced, so everything that
 * is not translated (markup, code, link targets, blank lines, reference definitions) stays exactly
 * as written. A unit whose text cannot be found in the source is left untranslated.
 */

export interface ExportResult {
  markdown: string;
  /** Units that were left in the source language: not translated yet, failed, or not found. */
  untranslated: number;
}

/** `translationOf(row, unit)` is the unit's translation with code and links restored, or undefined. */
export function exportTranslation(
  md: MarkdownIt,
  text: string,
  doc: SegmentedDocument,
  translationOf: (row: number, unit: number) => string | undefined,
): ExportResult {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let untranslated = 0;
  let next = 0;
  doc.rows.forEach((row, index) => {
    out.push(...lines.slice(next, row.startLine));
    const texts = row.units.map((unit, k) => (unit.translatable ? translationOf(index, k) : undefined));
    const result = translateRow(md, row, texts);
    untranslated += result.untranslated;
    out.push(result.markdown);
    next = row.endLine;
  });
  out.push(...lines.slice(next));
  return { markdown: out.join("\n"), untranslated };
}

function translateRow(md: MarkdownIt, row: Row, texts: ReadonlyArray<string | undefined>): ExportResult {
  let source = row.source;
  let untranslated = 0;

  // Comments first: they are found through the fenced code blocks, whose content is copied as written.
  const edits = new Map<number, CommentEdit[]>();
  row.units.forEach((unit, k) => {
    if (!unit.comment || !unit.translatable) return;
    const text = texts[k];
    if (text === undefined) untranslated++;
    else edits.set(unit.comment.block, [...(edits.get(unit.comment.block) ?? []), { slot: unit.comment.slot, text }]);
  });
  if (edits.size > 0) {
    const fences = fencesOf(md.parse(row.source, {}));
    let cursor = 0;
    fences.forEach((fence, block) => {
      const at = source.indexOf(fence.content, cursor);
      if (at < 0) return;
      const blockEdits = edits.get(block);
      if (!blockEdits) {
        cursor = at + fence.content.length;
        return;
      }
      const content = spliceComments(fence.content, blockEdits);
      source = source.slice(0, at) + content + source.slice(at + fence.content.length);
      cursor = at + content.length;
    });
  }

  let cursor = 0;
  row.units.forEach((unit, k) => {
    if (unit.comment) return;
    const found = findText(source, unit.source, cursor);
    const text = texts[k];
    if (!found) {
      if (unit.translatable) untranslated++;
      return;
    }
    if (text === undefined) {
      if (unit.translatable) untranslated++;
      cursor = found.end;
      return;
    }
    // Continuation lines keep the indentation or quote markers of the source.
    const replacement = text.split("\n").join(`\n${found.prefix}`);
    source = source.slice(0, found.start) + replacement + source.slice(found.end);
    cursor = found.start + replacement.length;
  });
  return { markdown: source, untranslated };
}

interface Found {
  start: number;
  end: number;
  /** What precedes each continuation line, such as indentation or `> `. */
  prefix: string;
}

const PREFIX_RE = /^[ \t>]*$/;

/**
 * Finds a unit's text in its row. The parser strips indentation and quote markers from continuation
 * lines, so a text of several lines is matched line by line, with only those between the lines.
 */
export function findText(source: string, text: string, from: number): Found | undefined {
  const exact = source.indexOf(text, from);
  if (exact >= 0 && !text.includes("\n")) return { start: exact, end: exact + text.length, prefix: "" };

  const lines = text.split("\n");
  let start = source.indexOf(lines[0]!, from);
  while (start >= 0) {
    const match = matchLines(source, lines, start);
    if (match) return match;
    start = source.indexOf(lines[0]!, start + 1);
  }
  return undefined;
}

function matchLines(source: string, lines: readonly string[], start: number): Found | undefined {
  let end = start + lines[0]!.length;
  let prefix: string | undefined;
  for (const line of lines.slice(1)) {
    if (source[end] !== "\n") return undefined;
    const lineStart = end + 1;
    const at = source.indexOf(line, lineStart);
    if (at < 0) return undefined;
    const between = source.slice(lineStart, at);
    if (between.includes("\n") || !PREFIX_RE.test(between)) return undefined;
    prefix ??= between;
    end = at + line.length;
  }
  return { start, end, prefix: prefix ?? "" };
}

/** BCP 47 codes for common target languages, for naming the exported file. */
const LANGUAGE_CODES: Record<string, string> = {
  arabic: "ar",
  "chinese": "zh",
  "simplified chinese": "zh-CN",
  "traditional chinese": "zh-TW",
  dutch: "nl",
  english: "en",
  french: "fr",
  german: "de",
  hindi: "hi",
  indonesian: "id",
  italian: "it",
  japanese: "ja",
  "日本語": "ja",
  korean: "ko",
  polish: "pl",
  portuguese: "pt",
  "brazilian portuguese": "pt-BR",
  russian: "ru",
  spanish: "es",
  thai: "th",
  turkish: "tr",
  ukrainian: "uk",
  vietnamese: "vi",
};

/** A short code for a target language, such as `ja` for `Japanese`, to name `README.ja.md`. */
export function languageCode(targetLanguage: string): string {
  const name = targetLanguage.trim();
  const known = LANGUAGE_CODES[name.toLowerCase()];
  if (known) return known;
  if (/^[a-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/i.test(name)) return name.replace(/_/g, "-");
  const slug = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "translated";
}

/** `README.md` → `README.ja.md`. */
export function exportFileName(documentName: string, targetLanguage: string): string {
  const code = languageCode(targetLanguage);
  const match = /^(.*?)(\.(?:md|markdown|mdx|mdown|mkd))$/i.exec(documentName);
  return match ? `${match[1]}.${code}${match[2]}` : `${documentName}.${code}.md`;
}
