import { describe, expect, it } from "vitest";
import { normalizeTranslation, validateTranslation } from "../src/translate/validate";

describe("normalizeTranslation", () => {
  it("removes a wrapping code fence, CRLF and surrounding whitespace", () => {
    expect(normalizeTranslation("```markdown\r\nこんにちは\r\n世界\r\n```\n")).toBe("こんにちは\n世界");
  });

  it("normalizes spaced and full-width placeholders", () => {
    expect(normalizeTranslation(" ⟦ 1 ⟧ と ⟦２⟧ ")).toBe("⟦1⟧ と ⟦2⟧");
  });
});

describe("validateTranslation", () => {
  it("accepts a translation that keeps every placeholder and bracket", () => {
    expect(validateTranslation("See [docs]⟦1⟧ and ⟦2⟧.", "⟦2⟧ と [ドキュメント]⟦1⟧ を参照。", 2)).toEqual([]);
  });

  it("reports empty output", () => {
    expect(validateTranslation("Hello", "  ", 0)).toEqual(["empty"]);
  });

  it("reports missing and unexpected placeholders", () => {
    expect(validateTranslation("a ⟦1⟧ b ⟦2⟧", "あ ⟦1⟧ ⟦3⟧ ⟦0⟧", 2)).toEqual(["missingPlaceholders", "unexpectedPlaceholders"]);
  });

  it("reports unbalanced link brackets", () => {
    expect(validateTranslation("[docs]⟦1⟧", "ドキュメント⟦1⟧", 1)).toEqual(["brackets"]);
  });

  it("does not count brackets in plain text such as code comments", () => {
    expect(validateTranslation("see [x] and ⟦1⟧", "x と ⟦1⟧ を参照", 1, false)).toEqual([]);
    expect(validateTranslation("see [x] and ⟦1⟧", "x を参照", 1, false)).toEqual(["missingPlaceholders"]);
  });
});
