import { toAsciiDigits } from "./mask";

export type ValidationProblem = "empty" | "missingPlaceholders" | "unexpectedPlaceholders" | "brackets";

const FENCED_RE = /^\s*```[^\n]*\n([\s\S]*?)\n\s*```\s*$/;
const LOOSE_PLACEHOLDER_RE = /⟦\s*([0-9０-９]+)\s*⟧/g;
const PLACEHOLDER_RE = /⟦(\d+)⟧/g;

/** Undoes harmless model quirks: CRLF, a wrapping code fence, spaced or full-width placeholder digits. */
export function normalizeTranslation(raw: string): string {
  let text = raw.replace(/\r\n?/g, "\n");
  const fenced = FENCED_RE.exec(text);
  if (fenced) text = fenced[1] ?? "";
  text = text.replace(LOOSE_PLACEHOLDER_RE, (_match, digits: string) => `⟦${toAsciiDigits(digits)}⟧`);
  return text.trim();
}

/**
 * Checks that a translation kept everything the renderer depends on. Brackets matter for links in
 * Markdown; in plain text such as code comments they are just characters, so `brackets` can be off.
 */
export function validateTranslation(masked: string, translated: string, placeholderCount: number, brackets = true): ValidationProblem[] {
  if (translated.trim() === "") return ["empty"];
  const problems: ValidationProblem[] = [];
  const seen = new Set<number>();
  let unexpected = false;
  for (const match of translated.matchAll(PLACEHOLDER_RE)) {
    const n = Number(match[1]);
    if (n >= 1 && n <= placeholderCount) seen.add(n);
    else unexpected = true;
  }
  if (seen.size < placeholderCount) problems.push("missingPlaceholders");
  if (unexpected) problems.push("unexpectedPlaceholders");
  if (brackets && (count(masked, "[") !== count(translated, "[") || count(masked, "]") !== count(translated, "]"))) {
    problems.push("brackets");
  }
  return problems;
}

function count(text: string, ch: string): number {
  let n = 0;
  for (const c of text) if (c === ch) n++;
  return n;
}
