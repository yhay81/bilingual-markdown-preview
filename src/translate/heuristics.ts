const LETTER_RE = /\p{L}/u;
const PLACEHOLDER_RE = /⟦\d+⟧/g;
const MASKED_IMAGE_RE = /!\[[^\]]*\]⟦\d+⟧/g;
const KANA_RE = /[\p{Script=Hiragana}\p{Script=Katakana}]/gu;
const HAN_RE = /\p{Script=Han}/gu;
const LATIN_RE = /\p{Script=Latin}/gu;
const LETTERS_RE = /\p{L}/gu;
const WORD_RE = /\p{L}+/gu;

/** False for segments that are only code, URLs, images, numbers or punctuation once masked. */
export function hasTranslatableText(masked: string): boolean {
  const text = masked.replace(MASKED_IMAGE_RE, "").replace(PLACEHOLDER_RE, "");
  return LETTER_RE.test(text);
}

interface Language {
  /** ISO 639 codes, matched at the start of the setting (`ja`, `ja-JP`). */
  codes: readonly string[];
  /** Names, matched as words anywhere in the setting (`Simplified Chinese`). */
  names: readonly string[];
  /** Whether `text` (masked, placeholders removed) is already in this language. */
  test: (text: string) => boolean;
}

const count = (text: string, re: RegExp): number => text.match(re)?.length ?? 0;

/** The text is mostly written in `script`, which none of `excluded` (letters of related languages) appear in. */
function inScript(script: RegExp, excluded?: RegExp): (text: string) => boolean {
  return (text) => {
    const letters = count(text, LETTERS_RE);
    const inside = count(text, script);
    return inside > 0 && inside * 2 >= letters && !(excluded?.test(text) ?? false);
  };
}

/**
 * Common short words of languages written in the Latin script. Text counts as one of them when
 * enough of its words are on that list and clearly more than on any other.
 */
const STOPWORDS: Record<string, ReadonlySet<string>> = {
  en: new Set("the and of to is are in for with that this it on be as you your can not from by an or will have if when which".split(" ")),
  es: new Set("el los las y que es por para con una del se su como más al lo este esta son está pero también".split(" ")),
  fr: new Set("le les et des du est une pour dans qui pas sur avec ce cette il vous sont au aux ne plus mais".split(" ")),
  de: new Set("der die das und ist nicht mit ein eine den dem zu für auf im sich auch sie wird werden oder von bei wenn kann".split(" ")),
  pt: new Set("o os e do da dos das em que é para com um uma não por no na ao mais você são está também".split(" ")),
  it: new Set("il gli e di che è per con un una non del della dei si sono da al alla più questo come anche".split(" ")),
};

function stopwordRatios(text: string): Map<string, number> {
  const words = text.toLowerCase().match(WORD_RE) ?? [];
  const ratios = new Map<string, number>();
  if (words.length < 4) return ratios;
  for (const [code, list] of Object.entries(STOPWORDS)) {
    ratios.set(code, words.filter((word) => list.has(word)).length / words.length);
  }
  return ratios;
}

function inLatinLanguage(code: string): (text: string) => boolean {
  return (text) => {
    if (count(text, LATIN_RE) * 2 < count(text, LETTERS_RE)) return false;
    const ratios = stopwordRatios(text);
    const own = ratios.get(code) ?? 0;
    if (own < 0.15) return false;
    return [...ratios].every(([other, ratio]) => other === code || own > ratio * 2);
  };
}

const LANGUAGES: readonly Language[] = [
  {
    codes: ["ja", "jp", "jpn"],
    names: ["japanese", "日本語"],
    test: (text) => {
      const kana = count(text, KANA_RE);
      return kana > 0 && kana + count(text, HAN_RE) >= count(text, LATIN_RE);
    },
  },
  // Without kana, so Japanese is not taken for Chinese.
  { codes: ["zh", "zho", "chi"], names: ["chinese", "mandarin", "中文", "简体中文", "繁體中文"], test: (text) => count(text, KANA_RE) === 0 && inScript(HAN_RE)(text) },
  { codes: ["ko", "kor"], names: ["korean", "한국어"], test: inScript(/[\p{Script=Hangul}\p{Script=Han}]/gu, /^[^\p{Script=Hangul}]*$/u) },
  // Ukrainian and Russian share the script; each has letters the other lacks.
  { codes: ["ru", "rus"], names: ["russian", "русский"], test: inScript(/\p{Script=Cyrillic}/gu, /[іїєґІЇЄҐ]/u) },
  { codes: ["uk", "ukr"], names: ["ukrainian", "українська"], test: inScript(/\p{Script=Cyrillic}/gu, /[ыэъЫЭЪ]/u) },
  { codes: ["el", "ell", "gre"], names: ["greek", "ελληνικά"], test: inScript(/\p{Script=Greek}/gu) },
  // Persian and Urdu use the same script with letters of their own.
  { codes: ["ar", "ara"], names: ["arabic", "العربية"], test: inScript(/\p{Script=Arabic}/gu, /[پچژگکی]/u) },
  { codes: ["he", "heb", "iw"], names: ["hebrew", "עברית"], test: inScript(/\p{Script=Hebrew}/gu) },
  { codes: ["th", "tha"], names: ["thai", "ไทย"], test: inScript(/\p{Script=Thai}/gu) },
  { codes: ["hi", "hin"], names: ["hindi", "हिन्दी", "हिंदी"], test: inScript(/\p{Script=Devanagari}/gu) },
  { codes: ["en", "eng"], names: ["english"], test: inLatinLanguage("en") },
  { codes: ["es", "spa"], names: ["spanish", "español", "castellano"], test: inLatinLanguage("es") },
  { codes: ["fr", "fra", "fre"], names: ["french", "français"], test: inLatinLanguage("fr") },
  { codes: ["de", "deu", "ger"], names: ["german", "deutsch"], test: inLatinLanguage("de") },
  { codes: ["pt", "por"], names: ["portuguese", "português"], test: inLatinLanguage("pt") },
  { codes: ["it", "ita"], names: ["italian", "italiano"], test: inLatinLanguage("it") },
];

const languageCache = new Map<string, Language | undefined>();

function languageOf(targetLanguage: string): Language | undefined {
  const value = targetLanguage.trim().toLowerCase();
  if (languageCache.has(value)) return languageCache.get(value);
  const language = LANGUAGES.find(
    (language) =>
      language.codes.some((code) => value === code || new RegExp(`^${code}[-_ (]`).test(value)) ||
      language.names.some((name) => new RegExp(`(?:^|[^\\p{L}])${name}(?![\\p{L}])`, "u").test(value)),
  );
  if (languageCache.size > 100) languageCache.clear();
  languageCache.set(value, language);
  return language;
}

export function isJapaneseTarget(targetLanguage: string): boolean {
  return languageOf(targetLanguage)?.codes[0] === "ja";
}

/**
 * Cheap check for text that is already in the target language, so mixed-language documents do
 * not pay for translating what the reader can already read. It errs on the side of translating:
 * short or mixed text, and languages it does not know, are always sent.
 */
export function looksLikeTargetLanguage(masked: string, targetLanguage: string): boolean {
  const language = languageOf(targetLanguage);
  if (!language) return false;
  return language.test(masked.replace(PLACEHOLDER_RE, ""));
}
