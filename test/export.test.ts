import { describe, expect, it } from "vitest";
import { createMarkdownEngine } from "../src/markdown/engine";
import { exportFileName, exportTranslation, findText, languageCode } from "../src/markdown/export";
import { segmentDocument } from "../src/markdown/segment";
import { unmask } from "../src/translate/mask";

const md = createMarkdownEngine();

/** Exports `text` with each unit's masked text passed through `translate`. */
function exportWith(text: string, translate: (masked: string) => string | undefined, translateCodeComments = false) {
  const doc = segmentDocument(md, text, { targetLanguage: "Japanese", translateCodeComments });
  return exportTranslation(md, text, doc, (row, k) => {
    const unit = doc.rows[row]!.units[k]!;
    const translated = translate(unit.masked);
    return translated === undefined ? undefined : unmask(translated, unit.placeholders);
  });
}

describe("findText", () => {
  it("finds single lines exactly", () => {
    expect(findText("# Hello\nHello", "Hello", 3)).toEqual({ start: 8, end: 13, prefix: "" });
  });

  it("matches continuation lines across quote markers and indentation", () => {
    const source = "> first line\n> second line";
    expect(findText(source, "first line\nsecond line", 0)).toEqual({ start: 2, end: source.length, prefix: "> " });
    expect(findText("- item\n  more", "item\nmore", 0)).toEqual({ start: 2, end: 13, prefix: "  " });
    expect(findText("a\nx b", "a\nb", 0)).toBeUndefined();
  });
});

describe("exportTranslation", () => {
  it("replaces text and keeps markup, code, links and blank lines", () => {
    const source = "# Title\n\nRun `npm test` and see [the guide](./guide.md).\n\n```js\nconst a = 1;\n```\n";
    const result = exportWith(source, (masked) =>
      ({ Title: "タイトル", "Run ⟦1⟧ and see [the guide]⟦2⟧.": "⟦1⟧ を実行し、[ガイド]⟦2⟧ を参照します。" })[masked],
    );
    expect(result).toEqual({
      markdown: "# タイトル\n\n`npm test` を実行し、[ガイド](./guide.md) を参照します。\n\n```js\nconst a = 1;\n```\n",
      untranslated: 0,
    });
  });

  it("keeps list markers and quote markers on every line", () => {
    const source = "- one\n- two\n\n> quoted\n> text\n";
    const result = exportWith(source, (masked) => ({ one: "一", two: "二", "quoted\ntext": "引用\n文" })[masked]);
    expect(result.markdown).toBe("- 一\n- 二\n\n> 引用\n> 文\n");
  });

  it("counts what is left untranslated", () => {
    const result = exportWith("First.\n\nSecond.\n", (masked) => (masked === "First." ? "最初。" : undefined));
    expect(result).toEqual({ markdown: "最初。\n\nSecond.\n", untranslated: 1 });
  });

  it("writes translated comments into code blocks", () => {
    const source = "```python\n# Add one\nx += 1\n```\n";
    const result = exportWith(source, (masked) => (masked === "Add one" ? "1 を足す" : undefined), true);
    expect(result.markdown).toBe("```python\n# 1 を足す\nx += 1\n```\n");
  });

  it("translates the summary of a details block", () => {
    const source = "<details>\n<summary>More options</summary>\n\nHidden text.\n\n</details>\n";
    const result = exportWith(source, (masked) => ({ "More options": "その他のオプション", "Hidden text.": "隠れた文。" })[masked]);
    expect(result.markdown).toBe("<details>\n<summary>その他のオプション</summary>\n\n隠れた文。\n\n</details>\n");
  });
});

describe("export file names", () => {
  it("knows common languages and keeps language codes", () => {
    expect(["Japanese", "日本語", "Simplified Chinese", "pt_BR", "ko", "Klingon (formal)"].map(languageCode)).toEqual([
      "ja",
      "ja",
      "zh-CN",
      "pt-BR",
      "ko",
      "klingon-formal",
    ]);
  });

  it("adds the code before the extension", () => {
    expect(exportFileName("README.md", "Japanese")).toBe("README.ja.md");
    expect(exportFileName("guide.markdown", "French")).toBe("guide.fr.markdown");
    expect(exportFileName("notes", "German")).toBe("notes.de.md");
  });
});
