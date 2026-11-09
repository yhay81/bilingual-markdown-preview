import { createHash } from "node:crypto";
import { PROMPT_VERSION, type PromptSettings } from "./prompt";

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

/** Cache key of one segment: the masked text and its placeholders fully determine the request and the result. */
export function translationKey(fingerprint: string, masked: string, placeholders: readonly string[]): string {
  return digest(JSON.stringify([fingerprint, masked, placeholders]));
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url").slice(0, 32);
}
