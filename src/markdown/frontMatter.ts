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

/** Front matter key that sets the language a document is translated into, as in `translate-to: English`. */
export const TARGET_LANGUAGE_KEY = "translate-to";

/**
 * The language a document asks to be translated into, from its front matter. Only a plain one-line
 * value of at most 60 characters counts, since it goes into the prompt.
 */
export function documentTargetLanguage(text: string): string | undefined {
  const { frontMatter } = splitFrontMatter(text.replace(/\r\n?/g, "\n"));
  if (!frontMatter) return undefined;
  for (const line of frontMatter.raw.split("\n")) {
    const match = /^translate-to[ \t]*:[ \t]*(.*?)[ \t]*$/.exec(line);
    if (!match) continue;
    let value = match[1]!.replace(/[ \t]+#.*$/, "");
    const quoted = /^(["'])(.*)\1$/.exec(value);
    if (quoted) value = quoted[2]!;
    value = value.trim();
    return value && value.length <= 60 && /^[\p{L}\p{M}\p{N} ()_-]+$/u.test(value) ? value : undefined;
  }
  return undefined;
}
