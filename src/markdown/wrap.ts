/**
 * Line widths in monospace text, where CJK and other wide characters take two columns, and line
 * breaking for translated code comments.
 */

/** Characters that must not start a line, and characters that must not end one (simplified kinsoku rules). */
const NO_LINE_START = new Set([..."、。，．・：；？！ー～…‥」』）］｝〕〉》】〙〗’”ゝゞヽヾ々ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ,.:;?!)]}"]);
const NO_LINE_END = new Set([..."「『（［｛〔〈《【〘〖‘“([{"]);

/** Punctuation that ends a clause or a sentence, after which a line may break before anything. */
const CLAUSE_END = new Set([..."、。，．：；？！,.:;?!"]);

/** Finds the words in CJK text, which has no spaces between them. Without it, every character counts as a word. */
const wordSegmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("ja", { granularity: "word" }) : undefined;

/** Columns that `text` takes up in a monospace font. */
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) width += isWide(char) ? 2 : 1;
  return width;
}

/**
 * Breaks `line` into lines no wider than `width` where it can: at spaces and between the phrases of CJK text, never
 * inside a word. A phrase too wide for a line of its own breaks between its words.
 */
export function wrapLine(line: string, width: number): string[] {
  if (displayWidth(line) <= width) return [line];
  const indent = /^\s*/.exec(line)![0];
  const body = line.slice(indent.length);
  // Continue a list item under its text, not under its bullet.
  const bullet = /^(?:[-*+•]|\d+[.)])\s+/.exec(body)?.[0] ?? "";
  const continuation = indent + " ".repeat(displayWidth(bullet));
  const room = width - displayWidth(continuation);

  const lines: string[] = [];
  let current = indent;
  let currentWidth = displayWidth(indent);
  let filled = false;
  const add = (text: string): void => {
    const textWidth = displayWidth(text);
    if (filled && currentWidth + textWidth > width) {
      lines.push(current.trimEnd());
      current = continuation;
      currentWidth = displayWidth(continuation);
    }
    current += text;
    currentWidth += textWidth;
    filled = true;
  };
  for (const words of phrasesOf(body)) {
    const phrase = words.join("");
    if (/^\s/.test(phrase)) {
      if (filled) {
        current += phrase;
        currentWidth += displayWidth(phrase);
      }
    } else if (displayWidth(phrase) > room) {
      for (const word of words) add(word);
    } else {
      add(phrase);
    }
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

/**
 * Units that a line may break between, each as the words it may break into: runs of spaces, words, and phrases of
 * Japanese text, which keep particles and endings with the word before them and katakana words whole.
 */
function phrasesOf(text: string): string[][] {
  const phrases: string[][] = [];
  for (const word of wordsOf(text)) {
    const phrase = phrases.at(-1);
    if (phrase !== undefined && joinsPhrase(lastChar(phrase.at(-1)!), firstChar(word))) phrase.push(word);
    else phrases.push([word]);
  }
  return phrases;
}

/** Whether a word that starts with `first` belongs to the phrase that ends with `last`. */
function joinsPhrase(last: string, first: string): boolean {
  if (isKatakana(first)) return isKatakana(last);
  return isHiragana(first) && !/\s/.test(last) && !CLAUSE_END.has(last);
}

/** Runs of spaces, words, and the words of CJK text, with the punctuation that sticks to them. */
function wordsOf(text: string): string[] {
  const words: string[] = [];
  let word = "";
  let wide = "";
  const flush = (): void => {
    if (word !== "") words.push(word);
    if (wide !== "") words.push(...(wordSegmenter ? Array.from(wordSegmenter.segment(wide), ({ segment }) => segment) : [...wide]));
    word = "";
    wide = "";
  };
  for (const char of text) {
    if (/\s/.test(char)) {
      flush();
      if (/\s$/.test(words.at(-1) ?? "")) words[words.length - 1] += char;
      else words.push(char);
    } else if (isWide(char)) {
      if (word !== "") flush();
      wide += char;
    } else {
      if (wide !== "") flush();
      word += char;
    }
  }
  flush();

  const merged: string[] = [];
  for (const word of words) {
    const previous = merged.at(-1);
    const sticks =
      previous !== undefined &&
      !/\s/.test(word[0]!) &&
      !/\s$/.test(previous) &&
      (NO_LINE_START.has(firstChar(word)) || NO_LINE_END.has(lastChar(previous)));
    if (sticks) merged[merged.length - 1] = previous + word;
    else merged.push(word);
  }
  return merged;
}

function isHiragana(char: string): boolean {
  const cp = char.codePointAt(0) ?? 0;
  return cp >= 0x3041 && cp <= 0x309f;
}

function isKatakana(char: string): boolean {
  const cp = char.codePointAt(0) ?? 0;
  return (cp >= 0x30a0 && cp <= 0x30ff) || (cp >= 0x31f0 && cp <= 0x31ff);
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
