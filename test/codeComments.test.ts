import { describe, expect, it } from "vitest";
import { findComments, spliceComments, type CommentSlot } from "../src/markdown/codeComments";
import { displayWidth, joinLines, wrapLine } from "../src/markdown/wrap";

function texts(code: string, info: string): string[] {
  return findComments(code, info).map((comment) => comment.text);
}

/** Writes `translations[k]` over the k-th comment found in `code`. */
function splice(code: string, info: string, translations: string[]): string {
  const comments = findComments(code, info);
  return spliceComments(
    code,
    translations.map((text, k) => ({ slot: comments[k]!.slot, text })),
  );
}

describe("findComments", () => {
  it("finds line and block comments and skips strings", () => {
    const code = [
      'const url = "https://example.com"; // the endpoint',
      "/* A block",
      "   comment */",
      "const s = 'it\\'s // not a comment';",
      "const t = `template // not a comment`;",
    ].join("\n");
    expect(texts(code, "js")).toEqual(["the endpoint", "A block\ncomment"]);
  });

  it("reads consecutive whole-line comments with the same marker and column as one", () => {
    const code = ["// First line", "// continues here.", "//", "// Second paragraph.", "x(); // trailing", "    // indented", "/// doc comment"].join("\n");
    expect(texts(code, "ts")).toEqual(["First line\ncontinues here.\n\nSecond paragraph.", "trailing", "indented", "doc comment"]);
    expect(findComments(code, "ts")[0]?.slot).toMatchObject({ start: 3, linePrefix: "// ", multiline: true, wrapWidth: 40 });
    expect(findComments(code, "ts")[1]?.slot).toMatchObject({ linePrefix: "", multiline: false });
  });

  it("reads JSDoc-style comments without their stars", () => {
    const code = ["  /**", "   * Adds two numbers.", "   *", "   * @param a - the first", "   */", "  function add(a, b) {}"].join("\n");
    const [comment] = findComments(code, "ts");
    expect(comment?.text).toBe("Adds two numbers.\n\n@param a - the first");
    expect(comment?.slot).toMatchObject({ linePrefix: "   * ", multiline: true, close: "*/" });
  });

  it("leaves out comments that tools read", () => {
    const ts = [
      "// eslint-disable-next-line no-console",
      "console.log(1); // @ts-ignore",
      "/* istanbul ignore next */",
      "const f = /*#__PURE__*/ g();",
      "//go:build linux",
      "// A real comment",
      "// #region setup",
    ].join("\n");
    expect(texts(ts, "ts")).toEqual(["A real comment"]);
    const python = ["# -*- coding: utf-8 -*-", "# noqa: E501", "x = 1  # type: ignore", "# Real comment"].join("\n");
    expect(texts(python, "python")).toEqual(["Real comment"]);
    expect(texts("# syntax=docker/dockerfile:1\nFROM node:22\n# Install dependencies\nRUN npm ci", "dockerfile")).toEqual(["Install dependencies"]);
  });

  it("does not read triple-quoted strings, strings or a shebang as comments", () => {
    const code = ["#!/usr/bin/env python3", "def f():", '    """Docstring with # hash."""', '    s = "# not a comment"  # but this is', "    return s"].join("\n");
    expect(texts(code, "python")).toEqual(["but this is"]);
  });

  it("starts shell comments only after whitespace", () => {
    expect(texts(['echo "$#" ${#arr[@]} # count', "# Install", "url=http://x/#top"].join("\n"), "bash")).toEqual(["count", "Install"]);
  });

  it("tells Rust lifetimes from character literals", () => {
    const code = [
      "fn f<'a>(s: &'a str) -> char { // returns the first char",
      '    let r = r"// not a comment";',
      "    let c = '\"'; // a quote",
      "}",
    ].join("\n");
    expect(texts(code, "rust")).toEqual(["returns the first char", "a quote"]);
  });

  it("knows the comment syntax of other languages", () => {
    expect(texts("SELECT 1; -- one\n/* two */", "sql")).toEqual(["one", "two"]);
    expect(texts("--[[ block\n  comment ]]\nlocal s = [[ -- not ]] -- three", "lua")).toEqual(["block\ncomment", "three"]);
    expect(texts("<!-- note -->\n<p>-- not</p>", "html")).toEqual(["note"]);
    expect(texts("; comment\nkey = a ; not\n# hash", "ini")).toEqual(["comment", "hash"]);
    expect(texts("a { color: red; } /* why */", "css")).toEqual(["why"]);
    expect(texts("<# block #>\n$x = 1 # line", "powershell")).toEqual(["block", "line"]);
  });

  it("reads the language from the info string and ignores the rest", () => {
    expect(texts("// x", "{.js}")).toEqual(["x"]);
    expect(texts("// x", 'ts title="a.ts"')).toEqual(["x"]);
    expect(texts("// x", "JavaScript")).toEqual(["x"]);
    expect(findComments("// x", "")).toEqual([]);
    expect(findComments("// x", "diff")).toEqual([]);
  });
});

describe("spliceComments", () => {
  it("writes translations with each comment's markers and prefixes", () => {
    const code = ["  // Adds two numbers", "  // and returns the sum.", "  add(a, b); // call it"].join("\n");
    expect(splice(code, "js", ["2 つの数を足して、\n合計を返します。", "呼び出す\n（1 行で）"])).toBe(
      ["  // 2 つの数を足して、", "  // 合計を返します。", "  add(a, b); // 呼び出す（1 行で）"].join("\n"),
    );
  });

  it("rewraps long lines to the comment's width and keeps blank lines", () => {
    const code = "# First line of the comment.\n# Second line.\nx = 1";
    expect(splice(code, "python", ["2 つの数を足して、その合計を返します。どちらの引数も有限の数です。\n\n次の段落。"])).toBe(
      ["# 2 つの数を足して、その合計を返します。", "# どちらの引数も有限の数です。", "#", "# 次の段落。", "x = 1"].join("\n"),
    );
  });

  it("continues block comments under their text and never closes them early", () => {
    expect(splice("/* note */ x();", "c", ["a */ b\nc"])).toBe("/* a * / b c */ x();");
    expect(splice("    /* short */\n", "c", ["一行目\n二行目"])).toBe("    /* 一行目\n       二行目 */\n");
    expect(splice("/**\n * Old.\n */", "java", ["新しい。\n続き。"])).toBe("/**\n * 新しい。\n * 続き。\n */");
  });

  it("skips edits that overlap or fall outside the code", () => {
    const slot = (start: number, end: number): CommentSlot => ({ start, end, linePrefix: "// ", multiline: true });
    expect(
      spliceComments("// a", [
        { slot: slot(3, 4), text: "あ" },
        { slot: slot(3, 4), text: "い" },
        { slot: slot(4, 10), text: "う" },
      ]),
    ).toBe("// あ");
  });
});

describe("wrap", () => {
  it("counts wide characters as two columns", () => {
    expect(displayWidth("abc")).toBe(3);
    expect(displayWidth("日本語")).toBe(6);
    expect(displayWidth("A（全角）")).toBe(9);
  });

  it("breaks at spaces, never inside a word", () => {
    expect(wrapLine("short", 40)).toEqual(["short"]);
    expect(wrapLine("alpha beta gamma delta", 11)).toEqual(["alpha beta", "gamma delta"]);
    expect(wrapLine("supercalifragilistic word", 5)).toEqual(["supercalifragilistic", "word"]);
    expect(wrapLine("  alpha beta", 8)).toEqual(["  alpha", "  beta"]);
  });

  it("breaks Japanese between phrases, with their particles, endings and punctuation", () => {
    expect(wrapLine("2 つの数を足して、その合計を返します。どちらの引数も有限の数でなければなりません。", 40)).toEqual([
      "2 つの数を足して、その合計を返します。",
      "どちらの引数も有限の",
      "数でなければなりません。",
    ]);
    expect(wrapLine("「設定」を開いて、保存します。", 12)).toEqual(["「設定」を", "開いて、", "保存します。"]);
  });

  it("keeps katakana words whole", () => {
    expect(wrapLine("翻訳ではプレースホルダーを残します", 20)).toEqual(["翻訳では", "プレースホルダーを", "残します"]);
  });

  it("breaks a phrase too wide for a line between its words", () => {
    const lines = wrapLine("数でなければなりません", 10);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("数でなければなりません");
  });

  it("breaks Chinese between words", () => {
    expect(wrapLine("这是一个用于翻译的扩展程序", 12).join("|")).not.toMatch(/翻\|译|扩\|展|程\|序/);
  });

  it("continues list items under their text", () => {
    expect(wrapLine("- one two three", 9)).toEqual(["- one two", "  three"]);
  });

  it("joins lines with spaces except between wide characters", () => {
    expect(joinLines(["Hello", " world ", "", "日本", "語です", "end"])).toBe("Hello world 日本語です end");
  });
});
