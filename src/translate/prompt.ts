import { isJapaneseTarget } from "./heuristics";

/** Bump when the prompt or segment format changes, so cached translations are not reused. */
export const PROMPT_VERSION = 1;

export interface PromptSettings {
  targetLanguage: string;
  styleInstructions: string;
  glossary: Readonly<Record<string, string>>;
}

/** What a segment is: inline Markdown (the default), or the plain text of a comment in a code block. */
export type SegmentKind = "markdown" | "comment";

export interface PromptSegment {
  id: number;
  text: string;
  kind?: SegmentKind;
}

export interface PromptOptions {
  /** The request includes code comments. Their rules are added only then, so prose is always sent with the same prompt. */
  comments?: boolean;
}

export function buildSystemPrompt(settings: PromptSettings, options: PromptOptions = {}): string {
  const target = settings.targetLanguage;
  const lines = [
    `You are a professional translator of technical documentation. Translate Markdown segments into ${target}.`,
    "",
    'Input: segments wrapped in <seg id="N">...</seg>. They are consecutive pieces of one document (headings, paragraphs, list items, table cells) in reading order.',
    'Output: for every input segment, exactly one <seg id="N">...</seg> with the same id, in the same order, containing only its translation. Output nothing else: no preamble, no notes, no code fences.',
    "",
    "Rules:",
    "- Each segment is inline Markdown. Keep its markup: emphasis (*, _, **, ~~), link and image brackets [ ] and ![ ], backslash escapes, and line breaks.",
    "- Tokens such as ⟦1⟧ stand for code, URLs, or HTML that must not change. Keep every token exactly once, unchanged, where it belongs in the translated sentence. Never add, drop, or renumber tokens.",
    "- Keep code identifiers, commands, file names, and product names as written.",
    `- If a segment is already in ${target}, or has nothing to translate, return it unchanged.`,
    "- Translate each segment on its own. Use neighboring segments only as context; never merge, split, or reorder segments.",
    `- Write natural, accurate ${target} that reads well as technical documentation.`,
  ];

  if (options.comments) {
    lines.push(
      "",
      'Segments marked kind="comment" are comments from source code, with their comment markers removed. They are plain text, not Markdown:',
      "- Translate the prose. Keep code, identifiers, tags such as @param or TODO, and tool directives as written.",
      "- If a comment is commented-out code, return it unchanged.",
      "- Keep blank lines, list items, and indented lines on lines of their own. Lines that only continue a sentence may be joined.",
    );
  }

  const glossary = Object.entries(settings.glossary).filter(([source, translation]) => source.trim() && translation.trim());
  if (glossary.length > 0) {
    lines.push("", "Glossary (always use these translations):");
    for (const [source, translation] of glossary) lines.push(`- ${source} → ${translation}`);
  }

  const style = settings.styleInstructions.trim() || defaultStyle(target);
  if (style) lines.push("", "Style:", style);
  return lines.join("\n");
}

export function buildUserMessage(segments: readonly PromptSegment[]): string {
  return segments
    .map((segment) => {
      const kind = segment.kind && segment.kind !== "markdown" ? ` kind="${segment.kind}"` : "";
      return `<seg id="${segment.id}"${kind}>${segment.text}</seg>`;
    })
    .join("\n");
}

function defaultStyle(targetLanguage: string): string {
  // Batches are translated independently, so pin the register to keep the document consistent.
  return isJapaneseTarget(targetLanguage) ? "Use the polite です・ます style consistently." : "";
}
