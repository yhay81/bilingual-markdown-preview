/**
 * Line widths in monospace text, where CJK and other wide characters take two columns, and line
 * breaking for translated code comments.
 */

/** Characters that must not start a line, and characters that must not end one (simplified kinsoku rules). */
const NO_LINE_START = new Set([..."、。，．・：；？！ー～…‥」』）］｝〕〉》】〙〗’”ゝゞヽヾ々ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ,.:;?!)]}"]);
const NO_LINE_END = new Set([..."「『（［｛〔〈《【〘〖‘“([{"]);

/** Columns that `text` takes up in a monospace font. */
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) width += isWide(char) ? 2 : 1;
  return width;
}

/** Breaks `line` into lines no wider than `width` where it can: at spaces and between CJK characters, never inside a word. */
export function wrapLine(line: string, width: number): string[] {
  if (displayWidth(line) <= width) return [line];
  const indent = /^\s*/.exec(line)![0];
  const body = line.slice(indent.length);
  // Continue a list item under its text, not under its bullet.
  const bullet = /^(?:[-*+•]|\d+[.)])\s+/.exec(body)?.[0] ?? "";
  const continuation = indent + " ".repeat(displayWidth(bullet));

  const lines: string[] = [];
  let current = indent;
  let currentWidth = displayWidth(indent);
  let filled = false;
  for (const chunk of chunksOf(body)) {
    const chunkWidth = displayWidth(chunk);
    if (/^\s/.test(chunk)) {
      if (filled) {
        current += chunk;
        currentWidth += chunkWidth;
      }
      continue;
    }
    if (filled && currentWidth + chunkWidth > width) {
      lines.push(current.trimEnd());
      current = continuation;
      currentWidth = displayWidth(continuation);
    }
    current += chunk;
    currentWidth += chunkWidth;
    filled = true;
  }
  lines.push(current.trimEnd());
  return lines;
}

/** Joins lines into one, with a space between them unless both sides are wide characters. */
export function joinLines(lines: readonly string[]): string {
  let joined = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") continue;
    if (joined !== "") joined += isWide(lastChar(joined)) && isWide(line) ? "" : " ";
    joined += line;
  }
  return joined;
}

/** Units that a line may break between: runs of spaces, words, and single wide characters with the punctuation that sticks to them. */
function chunksOf(text: string): string[] {
  const chunks: string[] = [];
  let word = "";
  const flush = (): void => {
    if (word !== "") chunks.push(word);
    word = "";
  };
  for (const char of text) {
    if (/\s/.test(char)) {
      flush();
      if (/\s$/.test(chunks.at(-1) ?? "")) chunks[chunks.length - 1] += char;
      else chunks.push(char);
    } else if (isWide(char)) {
      flush();
      chunks.push(char);
    } else {
      word += char;
    }
  }
  flush();

  const merged: string[] = [];
  for (const chunk of chunks) {
    const previous = merged.at(-1);
    const sticks =
      previous !== undefined &&
      !/\s/.test(chunk[0]!) &&
      !/\s$/.test(previous) &&
      (NO_LINE_START.has(firstChar(chunk)) || NO_LINE_END.has(lastChar(previous)));
    if (sticks) merged[merged.length - 1] = previous + chunk;
    else merged.push(chunk);
  }
  return merged;
}

/** Whether the first character of `text` is East Asian wide or fullwidth. */
function isWide(text: string): boolean {
  const cp = text.codePointAt(0) ?? 0;
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1f64f) ||
    (cp >= 0x1f900 && cp <= 0x1f9ff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  );
}

function firstChar(text: string): string {
  return String.fromCodePoint(text.codePointAt(0) ?? 0);
}

function lastChar(text: string): string {
  return [...text.slice(-2)].at(-1) ?? "";
}
