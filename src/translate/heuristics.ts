const LETTER_RE = /\p{L}/u;
const PLACEHOLDER_RE = /⟦\d+⟧/g;
const MASKED_IMAGE_RE = /!\[[^\]]*\]⟦\d+⟧/g;
const KANA_RE = /[\p{Script=Hiragana}\p{Script=Katakana}]/gu;
const HAN_RE = /\p{Script=Han}/gu;
const LATIN_RE = /\p{Script=Latin}/gu;
const JAPANESE_TARGET_RE = /^(?:ja(?:[-_]jp)?|jp|japanese|日本語)(?![a-z])/i;

/** False for segments that are only code, URLs, images, numbers or punctuation once masked. */
export function hasTranslatableText(masked: string): boolean {
  const text = masked.replace(MASKED_IMAGE_RE, "").replace(PLACEHOLDER_RE, "");
  return LETTER_RE.test(text);
}

export function isJapaneseTarget(targetLanguage: string): boolean {
  return JAPANESE_TARGET_RE.test(targetLanguage.trim());
}

/**
 * Cheap check for text that is already in the target language, so mixed-language documents
 * do not pay for translating what the reader can already read. Only Japanese is detected today.
 */
export function looksLikeTargetLanguage(masked: string, targetLanguage: string): boolean {
  if (!isJapaneseTarget(targetLanguage)) return false;
  const text = masked.replace(PLACEHOLDER_RE, "");
  const kana = text.match(KANA_RE)?.length ?? 0;
  const han = text.match(HAN_RE)?.length ?? 0;
  const latin = text.match(LATIN_RE)?.length ?? 0;
  return kana > 0 && kana + han >= latin;
}
