import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  fingerprintOf,
  providerSettingsOf,
  sanitizeConfig,
  serviceConfigOf,
  translationSettingsChanged,
} from "../src/settings";

describe("sanitizeConfig", () => {
  it("falls back to the defaults", () => {
    expect(sanitizeConfig({})).toEqual(DEFAULT_CONFIG);
  });

  it("repairs invalid values", () => {
    const config = sanitizeConfig({
      provider: "gemini",
      targetLanguage: "   ",
      anthropicModel: " claude-sonnet-5-5 ",
      openaiModel: 42,
      openaiBaseUrl: " https://gateway.example.com/v1/// ",
      reasoningEffort: "max",
      styleInstructions: `  ${"x".repeat(5000)}`,
      glossary: { " API ": " エーピーアイ ", empty: " ", count: 1 },
      maxConcurrentRequests: 100,
      batchCharacterLimit: 10,
      syncScroll: "yes",
    });
    expect(config).toEqual({
      ...DEFAULT_CONFIG,
      anthropicModel: "claude-sonnet-5-5",
      openaiBaseUrl: "https://gateway.example.com/v1",
      styleInstructions: "x".repeat(4000),
      glossary: { API: "エーピーアイ" },
      maxConcurrentRequests: 8,
      batchCharacterLimit: 500,
    });
  });

  it("rounds numbers and ignores glossaries that are not objects", () => {
    expect(sanitizeConfig({ maxConcurrentRequests: 4.4, batchCharacterLimit: Number.NaN, glossary: ["a"] })).toMatchObject({
      maxConcurrentRequests: 4,
      batchCharacterLimit: 4000,
      glossary: {},
    });
    expect(sanitizeConfig({ maxConcurrentRequests: 0, glossary: null }).maxConcurrentRequests).toBe(1);
  });
});

describe("derived settings", () => {
  const openai = sanitizeConfig({ provider: "openai", openaiBaseUrl: "https://gateway.example.com/v1" });

  it("sends the base URL to OpenAI only", () => {
    expect(providerSettingsOf(openai)).toEqual({
      provider: "openai",
      model: "gpt-6-luna",
      baseUrl: "https://gateway.example.com/v1",
      reasoningEffort: "none",
    });
    expect(providerSettingsOf({ ...openai, provider: "anthropic" })).toEqual({
      provider: "anthropic",
      model: "claude-haiku-5-5",
      baseUrl: "",
      reasoningEffort: "none",
    });
  });

  it("reserves output for reasoning only when the model may reason", () => {
    expect(serviceConfigOf(DEFAULT_CONFIG).usesReasoning).toBe(false);
    expect(serviceConfigOf({ ...DEFAULT_CONFIG, anthropicModel: "claude-opus-5-5" }).usesReasoning).toBe(true);
    expect(serviceConfigOf({ ...DEFAULT_CONFIG, reasoningEffort: "low" }).usesReasoning).toBe(true);
  });

  it("fingerprints exactly what changes a translation", () => {
    const base = fingerprintOf(DEFAULT_CONFIG);
    expect(
      fingerprintOf({ ...DEFAULT_CONFIG, maxConcurrentRequests: 8, batchCharacterLimit: 900, syncScroll: false, openaiBaseUrl: "https://x.example" }),
    ).toBe(base);
    const changes = [
      { targetLanguage: "French" },
      { anthropicModel: "claude-sonnet-5-5" },
      { provider: "openai" as const },
      { styleInstructions: "Be terse." },
      { glossary: { a: "b" } },
    ];
    for (const change of changes) expect(fingerprintOf({ ...DEFAULT_CONFIG, ...change })).not.toBe(base);
    expect(fingerprintOf(openai)).not.toBe(fingerprintOf({ ...openai, openaiBaseUrl: "" }));
    expect(fingerprintOf({ ...DEFAULT_CONFIG, glossary: { x: "1", y: "2" } })).toBe(fingerprintOf({ ...DEFAULT_CONFIG, glossary: { y: "2", x: "1" } }));
  });

  it("restarts translation when the reasoning effort changes", () => {
    expect(translationSettingsChanged(DEFAULT_CONFIG, { ...DEFAULT_CONFIG, reasoningEffort: "high" })).toBe(true);
    expect(translationSettingsChanged(DEFAULT_CONFIG, { ...DEFAULT_CONFIG, targetLanguage: "German" })).toBe(true);
    expect(translationSettingsChanged(DEFAULT_CONFIG, { ...DEFAULT_CONFIG, maxConcurrentRequests: 1, syncScroll: false })).toBe(false);
  });
});
