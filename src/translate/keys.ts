import { createHash } from "node:crypto";
import { PROMPT_VERSION, type PromptSettings, type SegmentKind } from "./prompt";

export interface FingerprintInput extends PromptSettings {
  provider: string;
  model: string;
  /** Custom API endpoint, or "" for the provider's default. */
  endpoint: string;
}

/** Identifies everything besides the source text that changes a translation. */
export function settingsFingerprint(input: FingerprintInput): string {
  const glossary = Object.entries(input.glossary).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return digest(
    JSON.stringify([
      PROMPT_VERSION,
      input.provider,
      input.model,
      input.endpoint,
      input.targetLanguage,
      input.styleInstructions,
      glossary,
    ]),
  );
}

/**
 * Cache key of one segment: the masked text, its placeholders and its kind fully determine the request and
 * the result. The same words in a paragraph and in a code comment are translated as different kinds of text.
 */
export function translationKey(fingerprint: string, masked: string, placeholders: readonly string[], kind: SegmentKind = "markdown"): string {
  return digest(JSON.stringify(kind === "markdown" ? [fingerprint, masked, placeholders] : [fingerprint, masked, placeholders, kind]));
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url").slice(0, 32);
}
