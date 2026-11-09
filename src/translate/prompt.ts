import { isJapaneseTarget } from "./heuristics";

/** Bump when the prompt or segment format changes, so cached translations are not reused. */
export const PROMPT_VERSION = 1;

export interface PromptSettings {
  targetLanguage: string;
  styleInstructions: string;
  glossary: Readonly<Record<string, string>>;
}

export interface PromptSegment {
  id: number;
  text: string;
}

export function buildSystemPrompt(settings: PromptSettings): string {
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
  return segments.map((segment) => `<seg id="${segment.id}">${segment.text}</seg>`).join("\n");
}

function defaultStyle(targetLanguage: string): string {
  // Batches are translated independently, so pin the register to keep the document consistent.
  return isJapaneseTarget(targetLanguage) ? "Use the polite です・ます style consistently." : "";
}
