import { describe, expect, it } from "vitest";
import { createMarkdownEngine } from "../src/markdown/engine";
import { RowRenderer } from "../src/markdown/render";
import { PreviewDocument, type DocumentContext } from "../src/preview/previewDocument";
import type { TokenUsage } from "../src/providers/types";
import { DEFAULT_CONFIG, type ExtensionConfig } from "../src/settings";
import type { TranslationResult } from "../src/translate/service";
import { testL10n } from "./helpers/l10n";

const md = createMarkdownEngine();
const renderer = new RowRenderer(md);


function setup(text: string, options: { config?: Partial<ExtensionConfig>; trusted?: boolean } = {}) {
  const results = new Map<string, TranslationResult>();
  const edits = new Map<string, string>();
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  const context: DocumentContext = {
    md,
    renderer,
    service: { getResult: (key) => results.get(key), getUsage: () => usage },
    edits: { get: (key) => edits.get(key) },
    l10n: testL10n,
  };
  const document = new PreviewDocument(context, {
    version: 1,
    text,
    config: { ...DEFAULT_CONFIG, ...options.config },
    trusted: options.trusted ?? true,
  });
  /** Marks the translation of every job whose masked text is `masked` as done. */
  const translate = (masked: string, translated: string, problems: Extract<TranslationResult, { state: "done" }>["problems"] = []) => {
    for (const job of document.jobs()) if (job.masked === masked) results.set(job.key, { state: "done", text: translated, problems });
  };
  const keyOf = (masked: string) => document.jobs().find((job) => job.masked === masked)!.key;
  return { document, results, edits, usage, translate, keyOf };
}

describe("PreviewDocument", () => {
  it("gives repeated text one key and finds every row that contains it", () => {
    const { document, keyOf } = setup("# Title\n\nHello.\n\nHello.\n");
    expect([...document.keys()]).toHaveLength(2);
    expect([...document.rowsWith([keyOf("Hello.")])]).toEqual([1, 2]);
    expect(document.rowKeys(1)).toEqual([keyOf("Hello.")]);
    expect(document.rowKeys(99)).toEqual([]);
  });

  it("sends the text before each segment as context, without code", () => {
    const { document } = setup("Run `npm test` first.\n\nThen deploy.\n");
    const [first, second] = document.jobs();
    expect(first).toMatchObject({ masked: "Run ⟦1⟧ first.", placeholders: ["`npm test`"], line: 0, kind: "markdown", context: undefined });
    expect(second).toMatchObject({ masked: "Then deploy.", line: 2, context: "\nRun first." });
  });

  it("uses the front matter's language only in a trusted workspace", () => {
    const text = "---\ntranslate-to: French\n---\n\nHello.\n";
    const trusted = setup(text).document;
    expect(trusted.documentLanguage).toBe("French");
    expect(trusted.targetLanguage).toBe("French");
    expect(trusted.jobs()[0]?.targetLanguage).toBe("French");
    const untrusted = setup(text, { trusted: false }).document;
    expect(untrusted.documentLanguage).toBeUndefined();
    expect(untrusted.targetLanguage).toBe(DEFAULT_CONFIG.targetLanguage);
  });

  it("shows each row as translating, done, flagged, failed or shared", () => {
    const { document, results, translate, keyOf } = setup("One.\n\nTwo.\n\nThree.\n\n```js\nx();\n```\n");
    expect(document.rowState(0)).toEqual({ index: 0, status: "translating" });
    translate("One.", "一。");
    expect(document.rowState(0)).toMatchObject({ status: "done", translationHtml: expect.stringContaining("一。") });
    translate("Two.", "二。", ["missingPlaceholders"]);
    expect(document.rowState(1)).toMatchObject({ status: "warning", message: "This translation may be missing code, links, or formatting." });
    results.set(keyOf("Three."), { state: "error", error: { kind: "overloaded", message: "Overloaded" } });
    expect(document.rowState(2)).toEqual({ index: 2, status: "error", message: "Overloaded" });
    expect(document.rowState(3)).toEqual({ index: 3, status: "shared" });
    expect(document.failedKeys()).toEqual([keyOf("Three.")]);
  });

  it("restores code in translations and prefers the user's edits", () => {
    const { document, edits, translate, keyOf } = setup("Run `npm test` first.\n");
    translate("Run ⟦1⟧ first.", "まず ⟦1⟧ を実行。");
    expect(document.translationOf(0, 0)).toBe("まず `npm test` を実行。");
    edits.set(keyOf("Run ⟦1⟧ first."), "最初に `npm test`。");
    expect(document.translationOf(0, 0)).toBe("最初に `npm test`。");
    expect(document.rowState(0)).toMatchObject({ status: "done", edited: true });
    expect(document.editableUnits(0)).toEqual([{ source: "Run `npm test` first.", text: "最初に `npm test`。" }]);
  });

  it("keeps an edit only when it differs from the machine translation", () => {
    const { document, translate, keyOf } = setup("| A | B |\n| - | - |\n| one | two |\n");
    translate("A", "あ");
    const keys = ["A", "B", "one", "two"].map(keyOf);
    expect(document.editsFor(0, ["あ", "び", " ", "に"])).toEqual([
      { key: keys[0], text: undefined },
      { key: keys[1], text: "び" },
      { key: keys[2], text: undefined },
      { key: keys[3], text: "に" },
    ]);
    expect(document.editsFor(0, undefined).map((change) => change.text)).toEqual([undefined, undefined, undefined, undefined]);
    expect(document.editsFor(5, ["x"])).toEqual([]);
  });

  it("counts progress over distinct segments and reports tokens once used", () => {
    const { document, results, usage, translate, keyOf } = setup("A.\n\nB.\n\nA.\n");
    translate("A.", "あ。");
    expect(document.progress()).toEqual({ total: 2, done: 1, failed: 0, model: DEFAULT_CONFIG.models.anthropic, targetLanguage: "Japanese" });
    results.set(keyOf("B."), { state: "error", error: { kind: "overloaded", message: "x" } });
    usage.inputTokens = 10;
    usage.outputTokens = 5;
    expect(document.progress()).toMatchObject({ failed: 1, tokens: 15 });
  });

  it("builds the row payload from the row and its state", () => {
    const { document } = setup("# Title\n");
    const payload = document.rowPayload(0, document.rowState(0));
    expect(payload).toMatchObject({ index: 0, shared: false, line: 0, endLine: 1, status: "translating", sourceHtml: expect.stringContaining("Title") });
  });

  it("exports the shown translations", () => {
    const text = "# Title\n\nBody.\n";
    const { document, translate } = setup(text);
    translate("Title", "タイトル");
    expect(document.exportMarkdown(text)).toEqual({ markdown: "# タイトル\n\nBody.\n", untranslated: 1 });
  });
});
