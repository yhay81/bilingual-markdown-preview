/**
 * Placeholder masking for inline Markdown.
 *
 * Before a segment goes to the model, everything that must come back unchanged (code spans,
 * URLs, link destinations, HTML, entities, hard line breaks) is replaced by a numbered token
 * such as ⟦1⟧. Link text, emphasis and prose stay visible so the model can translate them.
 */

export const PLACEHOLDER_OPEN = "⟦";
export const PLACEHOLDER_CLOSE = "⟧";

export interface MaskOptions {
  /** Normalized labels of the document's link reference definitions. */
  referenceLabels?: ReadonlySet<string>;
  /** Normalizes a label the same way the parser did (markdown-it's `normalizeReference`). */
  normalizeLabel?: (label: string) => string;
}

export interface MaskResult {
  masked: string;
  /** `placeholders[n - 1]` is the original text behind ⟦n⟧. */
  placeholders: string[];
}

type Hold = (original: string) => string;

const AUTOLINK_RE = /^<[A-Za-z][A-Za-z0-9.+-]{1,31}:[^<>\s]*>/;
const EMAIL_AUTOLINK_RE =
  /^<[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*>/;
const HTML_RE =
  /^(?:<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][A-Za-z0-9_.:-]*(?:\s*=\s*(?:[^"'=<>`\s]+|'[^']*'|"[^"]*"))?)*\s*\/?>|<\/[A-Za-z][A-Za-z0-9-]*\s*>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![A-Za-z][^>]*>|<!\[CDATA\[[\s\S]*?\]\]>)/;
const ENTITY_RE = /^&(?:#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/;
const BARE_URL_RE = /^(?:https?:\/\/|www\.)[^\s<>"'`]*[^\s<>"'`.,;:!?)\]}*_~]/i;
const HARD_BREAK_RE = /^ {2,}\n/;
const WORD_CHAR_RE = /[\p{L}\p{N}]/u;
const PLACEHOLDER_RE = /⟦\s*([0-9０-９]+)\s*⟧/g;

export function maskInline(source: string, options: MaskOptions = {}): MaskResult {
  const placeholders: string[] = [];
  const hold: Hold = (original) => {
    placeholders.push(original);
    return `${PLACEHOLDER_OPEN}${placeholders.length}${PLACEHOLDER_CLOSE}`;
  };
  return { masked: scan(source, 0, source.length, hold, options), placeholders };
}

/** Restores placeholders. Unknown placeholder numbers are dropped. */
export function unmask(text: string, placeholders: readonly string[]): string {
  return text.replace(PLACEHOLDER_RE, (_match, digits: string) => placeholders[Number(toAsciiDigits(digits)) - 1] ?? "");
}

export function toAsciiDigits(value: string): string {
  return value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

function scan(src: string, start: number, end: number, hold: Hold, options: MaskOptions): string {
  let out = "";
  let i = start;
  while (i < end) {
    const ch = src[i]!;
    switch (ch) {
      case "\\": {
        if (i + 1 < end && src[i + 1] === "\n") {
          out += `${hold("<br>")}\n`;
          i += 2;
          continue;
        }
        out += src.slice(i, Math.min(i + 2, end));
        i += 2;
        continue;
      }
      case " ": {
        const match = HARD_BREAK_RE.exec(src.slice(i, end));
        if (match) {
          out += `${hold("<br>")}\n`;
          i += match[0].length;
          continue;
        }
        break;
      }
      case "`": {
        const run = runLength(src, i, end, "`");
        const close = findBacktickClose(src, i + run, end, run);
        if (close >= 0) {
          out += hold(src.slice(i, close + run));
          i = close + run;
        } else {
          out += src.slice(i, i + run);
          i += run;
        }
        continue;
      }
      case "<": {
        const rest = src.slice(i, end);
        const match = AUTOLINK_RE.exec(rest) ?? EMAIL_AUTOLINK_RE.exec(rest) ?? HTML_RE.exec(rest);
        if (match) {
          out += hold(match[0]);
          i += match[0].length;
          continue;
        }
        break;
      }
      case "&": {
        const match = ENTITY_RE.exec(src.slice(i, end));
        if (match) {
          out += hold(match[0]);
          i += match[0].length;
          continue;
        }
        break;
      }
      case "[": {
        const bracket = maskBracket(src, i, end, hold, options);
        if (bracket) {
          out += bracket.text;
          i = bracket.next;
          continue;
        }
        break;
      }
      case PLACEHOLDER_OPEN:
      case PLACEHOLDER_CLOSE: {
        // The source happens to contain our delimiter: protect it so validation stays exact.
        out += hold(ch);
        i += 1;
        continue;
      }
      case "h":
      case "H":
      case "w":
      case "W": {
        if (i === start || !WORD_CHAR_RE.test(src[i - 1]!)) {
          const match = BARE_URL_RE.exec(src.slice(i, end));
          if (match) {
            out += hold(match[0]);
            i += match[0].length;
            continue;
          }
        }
        break;
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** Masks the non-translatable parts of `[text](dest)`, `[text][label]`, `[label]` and `[^note]`. */
function maskBracket(
  src: string,
  open: number,
  end: number,
  hold: Hold,
  options: MaskOptions,
): { text: string; next: number } | undefined {
  const close = findBracketClose(src, open, end);
  if (close < 0) return undefined;
  const inner = src.slice(open + 1, close);

  if (inner.startsWith("^")) {
    return { text: hold(src.slice(open, close + 1)), next: close + 1 };
  }

  const after = src[close + 1];
  if (after === "(") {
    const parenClose = findParenClose(src, close + 1, end);
    if (parenClose >= 0) {
      const text = `[${scan(src, open + 1, close, hold, options)}]`;
      return { text: text + hold(src.slice(close + 1, parenClose + 1)), next: parenClose + 1 };
    }
  }

  if (after === "[") {
    const labelClose = findBracketClose(src, close + 1, end);
    if (labelClose >= 0) {
      if (labelClose === close + 2) {
        // Collapsed reference `[text][]`: the text is the label, so it must stay as written.
        return { text: hold(src.slice(open, labelClose + 1)), next: labelClose + 1 };
      }
      const text = `[${scan(src, open + 1, close, hold, options)}]`;
      return { text: text + hold(src.slice(close + 1, labelClose + 1)), next: labelClose + 1 };
    }
  }

  const { referenceLabels, normalizeLabel } = options;
  if (referenceLabels && normalizeLabel && referenceLabels.has(normalizeLabel(inner))) {
    // Shortcut reference `[label]`: translating the label would break the link.
    return { text: hold(src.slice(open, close + 1)), next: close + 1 };
  }
  return undefined;
}

function findBracketClose(src: string, open: number, end: number): number {
  let depth = 0;
  for (let j = open; j < end; j++) {
    const c = src[j];
    if (c === "\\") {
      j++;
      continue;
    }
    if (c === "`") {
      const run = runLength(src, j, end, "`");
      const close = findBacktickClose(src, j + run, end, run);
      j = (close >= 0 ? close + run : j + run) - 1;
      continue;
    }
    if (c === "[") {
      depth++;
    } else if (c === "]") {
      depth--;
      if (depth === 0) return j;
    }
  }
  return -1;
}

function findParenClose(src: string, open: number, end: number): number {
  let depth = 0;
  let quote: string | undefined;
  let angle = false;
  for (let j = open; j < end; j++) {
    const c = src[j]!;
    if (c === "\\") {
      j++;
      continue;
    }
    if (quote) {
      if (c === quote) quote = undefined;
      continue;
    }
    if (angle) {
      if (c === ">") angle = false;
      continue;
    }
    if (c === "<" && j === open + 1) {
      angle = true;
    } else if ((c === '"' || c === "'") && /\s/.test(src[j - 1] ?? "")) {
      quote = c;
    } else if (c === "(") {
      depth++;
    } else if (c === ")") {
      depth--;
      if (depth === 0) return j;
    }
  }
  return -1;
}

function runLength(src: string, at: number, end: number, ch: string): number {
  let n = 0;
  while (at + n < end && src[at + n] === ch) n++;
  return n;
}

function findBacktickClose(src: string, from: number, end: number, run: number): number {
  let j = from;
  while (j < end) {
    if (src[j] === "`") {
      const n = runLength(src, j, end, "`");
      if (n === run) return j;
      j += n;
    } else {
      j++;
    }
  }
  return -1;
}
