import { describe, expect, it } from "vitest";
import { maskInline, unmask } from "../src/translate/mask";

const normalizeLabel = (label: string) => label.trim().replace(/\s+/g, " ").toUpperCase();

describe("maskInline", () => {
  it("keeps prose and masks code spans", () => {
    expect(maskInline("Run `npm install` first.")).toEqual({ masked: "Run ⟦1⟧ first.", placeholders: ["`npm install`"] });
  });

  it("handles longer backtick runs and unmatched backticks", () => {
    expect(maskInline("Use ``a ` b`` here").masked).toBe("Use ⟦1⟧ here");
    expect(maskInline("a ``b` c").masked).toBe("a ``b` c");
  });

  it("keeps link text translatable and masks the destination", () => {
    const result = maskInline('See [the docs](https://example.com/docs "Docs") now.');
    expect(result.masked).toBe("See [the docs]⟦1⟧ now.");
    expect(result.placeholders).toEqual(['(https://example.com/docs "Docs")']);
  });

  it("masks inside link text and handles parentheses in destinations", () => {
    expect(maskInline("[`foo` bar](x) and [a](https://x.com/a_(b)) c").masked).toBe("[⟦1⟧ bar]⟦2⟧ and [a]⟦3⟧ c");
  });

  it("keeps image alt text and masks the source", () => {
    expect(maskInline("![Logo](logo.png)")).toEqual({ masked: "![Logo]⟦1⟧", placeholders: ["(logo.png)"] });
  });

  it("masks reference labels, collapsed references and known shortcut references", () => {
    const options = { referenceLabels: new Set(["REF", "NPM"]), normalizeLabel };
    expect(maskInline("[text][ref] and [Ref][] and [npm] but not [other]", options)).toEqual({
      masked: "[text]⟦1⟧ and ⟦2⟧ and ⟦3⟧ but not [other]",
      placeholders: ["[ref]", "[Ref][]", "[npm]"],
    });
  });

  it("masks footnote references", () => {
    expect(maskInline("Text[^1].").masked).toBe("Text⟦1⟧.");
  });

  it("masks autolinks, email autolinks, inline HTML and entities", () => {
    const result = maskInline('Mail <me@example.com>, <https://x.y>, a<br/>b <span class="a">x</span> &amp; &#169;');
    expect(result.masked).toBe("Mail ⟦1⟧, ⟦2⟧, a⟦3⟧b ⟦4⟧x⟦5⟧ ⟦6⟧ ⟦7⟧");
    expect(result.placeholders).toEqual(["<me@example.com>", "<https://x.y>", "<br/>", '<span class="a">', "</span>", "&amp;", "&#169;"]);
  });

  it("masks bare URLs at word boundaries without trailing punctuation", () => {
    const result = maskInline("Visit https://example.com/a_b. Or www.example.org! Not awww.x");
    expect(result.masked).toBe("Visit ⟦1⟧. Or ⟦2⟧! Not awww.x");
    expect(result.placeholders).toEqual(["https://example.com/a_b", "www.example.org"]);
  });

  it("turns hard line breaks into <br> placeholders", () => {
    expect(maskInline("one  \ntwo\\\nthree\nfour")).toEqual({ masked: "one⟦1⟧\ntwo⟦2⟧\nthree\nfour", placeholders: ["<br>", "<br>"] });
  });

  it("keeps backslash escapes and protects literal placeholder delimiters", () => {
    expect(maskInline("\\*not emphasis\\*").masked).toBe("\\*not emphasis\\*");
    expect(maskInline("a ⟦1⟧ b")).toEqual({ masked: "a ⟦1⟧1⟦2⟧ b", placeholders: ["⟦", "⟧"] });
  });

  it("round-trips through unmask", () => {
    const source = "See [the guide](./guide.md#setup) and `code` <b>bold</b> https://example.com.";
    const { masked, placeholders } = maskInline(source);
    expect(unmask(masked, placeholders)).toBe(source);
  });
});

describe("unmask", () => {
  it("tolerates spaces and full-width digits", () => {
    expect(unmask("x ⟦ 1 ⟧ y ⟦２⟧", ["A", "B"])).toBe("x A y B");
  });

  it("drops unknown placeholders", () => {
    expect(unmask("a⟦3⟧b", ["x"])).toBe("ab");
  });
});

describe("math", () => {
  it("masks inline math and inline display math", () => {
    expect(maskInline("Energy is $E = mc^2$, and $$\\sum_i x_i$$ adds up.")).toEqual({
      masked: "Energy is ⟦1⟧, and ⟦2⟧ adds up.",
      placeholders: ["$E = mc^2$", "$$\\sum_i x_i$$"],
    });
  });

  it("leaves dollar amounts and escaped dollars alone, as the parser does", () => {
    expect(maskInline("It costs $5 or $10.").masked).toBe("It costs $5 or $10.");
    expect(maskInline("Pay \\$5 and $x$.").masked).toBe("Pay \\$5 and ⟦1⟧.");
    expect(maskInline("a$b$c").masked).toBe("a$b$c");
  });

  it("does not read dollars in comments as math", () => {
    expect(maskInline("costs $x$ here", { plainText: true }).masked).toBe("costs $x$ here");
  });
});
