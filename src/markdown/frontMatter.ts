export interface FrontMatter {
  /** The block as written, including its `---` fences, without the final newline. */
  raw: string;
  /** Number of document lines the block occupies. */
  lineCount: number;
}

export interface SplitDocument {
  frontMatter?: FrontMatter;
  body: string;
  /** Number of document lines before `body` starts. */
  bodyLineOffset: number;
}

const FRONT_MATTER_RE = /^---[ \t]*\n(?:[\s\S]*?\n)?(?:---|\.\.\.)[ \t]*(?:\n|$)/;

/**
 * Separates YAML front matter from the Markdown body. Left in place, markdown-it would
 * render it as a horizontal rule followed by a heading.
 */
export function splitFrontMatter(text: string): SplitDocument {
  const match = FRONT_MATTER_RE.exec(text);
  if (!match) return { body: text, bodyLineOffset: 0 };
  const raw = match[0];
  const newlines = raw.split("\n").length - 1;
  const lineCount = raw.endsWith("\n") ? newlines : newlines + 1;
  return {
    frontMatter: { raw: raw.endsWith("\n") ? raw.slice(0, -1) : raw, lineCount },
    body: text.slice(raw.length),
    bodyLineOffset: lineCount,
  };
}
