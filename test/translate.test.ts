import { describe, expect, it } from "vitest";
import { parseWebviewMessage } from "../src/shared/protocol";
import { hasTranslatableText, isJapaneseTarget, looksLikeTargetLanguage } from "../src/translate/heuristics";
import { settingsFingerprint, translationKey } from "../src/translate/keys";
import { buildSystemPrompt, buildUserMessage } from "../src/translate/prompt";

describe("buildSystemPrompt", () => {
  it("pins the polite style for Japanese unless told otherwise", () => {
    const prompt = buildSystemPrompt({ targetLanguage: "Japanese", styleInstructions: "", glossary: {} });
    expect(prompt).toContain("Translate Markdown segments into Japanese.");
    expect(prompt).toContain("Style:\nUse the polite です・ます style consistently.");
    expect(buildSystemPrompt({ targetLanguage: "Japanese", styleInstructions: " である調で書く。 ", glossary: {} })).toContain("Style:\nである調で書く。");
    expect(buildSystemPrompt({ targetLanguage: "French", styleInstructions: "", glossary: {} })).not.toContain("Style:");
  });

  it("lists glossary entries and skips blank ones", () => {
    const prompt = buildSystemPrompt({ targetLanguage: "Japanese", styleInstructions: "", glossary: { "pull request": "プルリクエスト", " ": "x" } });
    expect(prompt).toContain("Glossary (always use these translations):\n- pull request → プルリクエスト\n");
    expect(prompt).not.toContain("→ x");
  });
});

describe("buildUserMessage", () => {
  it("wraps segments in numbered tags", () => {
    expect(buildUserMessage([{ id: 1, text: "Hello" }, { id: 2, text: "a\nb" }])).toBe('<seg id="1">Hello</seg>\n<seg id="2">a\nb</seg>');
  });
});

describe("translation keys", () => {
  const settings = {
    provider: "anthropic",
    model: "claude-haiku-5-5",
    endpoint: "",
    targetLanguage: "Japanese",
    styleInstructions: "",
    glossary: { b: "2", a: "1" },
  };

  it("are stable, short and URL-safe", () => {
    const fingerprint = settingsFingerprint(settings);
    expect(settingsFingerprint({ ...settings, glossary: { a: "1", b: "2" } })).toBe(fingerprint);
    const key = translationKey(fingerprint, "Run ⟦1⟧", ["`npm test`"]);
    expect(key).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(translationKey(fingerprint, "Run ⟦1⟧", ["`npm test`"])).toBe(key);
  });

  it("change with anything that changes the translation", () => {
    const fingerprint = settingsFingerprint(settings);
    const key = translationKey(fingerprint, "Run ⟦1⟧", ["`npm test`"]);
    expect(translationKey(fingerprint, "Run ⟦1⟧", ["`npm run`"])).not.toBe(key);
    expect(translationKey(fingerprint, "Run ⟦1⟧ now", ["`npm test`"])).not.toBe(key);
    expect(settingsFingerprint({ ...settings, endpoint: "https://gateway.example.com/v1" })).not.toBe(fingerprint);
    expect(settingsFingerprint({ ...settings, model: "claude-sonnet-5-5" })).not.toBe(fingerprint);
  });
});

describe("heuristics", () => {
  it("skips segments with nothing to translate", () => {
    expect(hasTranslatableText("⟦1⟧ ⟦2⟧")).toBe(false);
    expect(hasTranslatableText("![Logo]⟦1⟧")).toBe(false);
    expect(hasTranslatableText("1. 2) — 42%")).toBe(false);
    expect(hasTranslatableText("Run ⟦1⟧")).toBe(true);
  });

  it("recognizes Japanese targets and text already in Japanese", () => {
    expect(["Japanese", "ja", "ja-JP", "日本語", "japanese (polite)"].map((value) => isJapaneseTarget(value))).toEqual([true, true, true, true, true]);
    expect(["Javanese", "jav", "English"].map((value) => isJapaneseTarget(value))).toEqual([false, false, false]);
    expect(looksLikeTargetLanguage("これは ⟦1⟧ の説明です。", "Japanese")).toBe(true);
    expect(looksLikeTargetLanguage("漢字", "Japanese")).toBe(false);
    expect(looksLikeTargetLanguage("Use ⟦1⟧ for テスト setup and configuration", "Japanese")).toBe(false);
    expect(looksLikeTargetLanguage("これは説明です。", "English")).toBe(false);
  });
});

describe("parseWebviewMessage", () => {
  it("accepts well-formed messages and drops unknown fields", () => {
    expect(parseWebviewMessage({ type: "ready", extra: 1 })).toEqual({ type: "ready" });
    expect(parseWebviewMessage({ type: "openLink", href: "https://example.com" })).toEqual({ type: "openLink", href: "https://example.com" });
    expect(parseWebviewMessage({ type: "visibleLine", line: 12.5 })).toEqual({ type: "visibleLine", line: 12.5 });
    expect(parseWebviewMessage({ type: "retryRow", index: 3 })).toEqual({ type: "retryRow", index: 3 });
    expect(parseWebviewMessage({ type: "action", action: "setApiKey" })).toEqual({ type: "action", action: "setApiKey" });
    expect(parseWebviewMessage({ type: "modeChanged", mode: "translation" })).toEqual({ type: "modeChanged", mode: "translation" });
  });

  it("rejects anything else", () => {
    const invalid: unknown[] = [
      null,
      "ready",
      42,
      [],
      {},
      { type: 1 },
      { type: "eval" },
      { type: "openLink", href: 1 },
      { type: "openLink", href: "x".repeat(4097) },
      { type: "visibleLine", line: -1 },
      { type: "visibleLine", line: Number.NaN },
      { type: "visibleLine", line: Number.POSITIVE_INFINITY },
      { type: "visibleLine", line: "3" },
      { type: "retryRow", index: 1.5 },
      { type: "retryRow", index: -1 },
      { type: "action", action: "runCommand" },
      { type: "modeChanged", mode: "split" },
    ];
    expect(invalid.map((message) => parseWebviewMessage(message))).toEqual(invalid.map(() => undefined));
  });
});
