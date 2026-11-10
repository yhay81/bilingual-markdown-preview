import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMarkdownEngine } from "../src/markdown/engine";
import { splitFrontMatter } from "../src/markdown/frontMatter";
import { RowRenderer } from "../src/markdown/render";
import { segmentDocument, type Row } from "../src/markdown/segment";
import { Slugger } from "../src/markdown/slug";
import { unmask } from "../src/translate/mask";

const md = createMarkdownEngine();
const renderer = new RowRenderer(md);
const sample = readFileSync(new URL("./fixtures/sample.md", import.meta.url), "utf8");

function segment(text: string, targetLanguage = "Japanese") {
  return segmentDocument(md, text, { targetLanguage });
}

function rowAt(rows: readonly Row[], line: number): Row {
  const row = rows.find((candidate) => candidate.startLine === line);
  if (!row) throw new Error(`no row at line ${line}`);
  return row;
}

describe("splitFrontMatter", () => {
  it("separates YAML front matter and counts its lines", () => {
    expect(splitFrontMatter("---\na: 1\n---\nbody")).toEqual({
      frontMatter: { raw: "---\na: 1\n---", lineCount: 3 },
      body: "body",
      bodyLineOffset: 3,
    });
  });

  it("handles front matter at the end of the file and documents without it", () => {
    expect(splitFrontMatter("---\n---").frontMatter).toEqual({ raw: "---\n---", lineCount: 2 });
    expect(splitFrontMatter("# Title\n---\n")).toEqual({ body: "# Title\n---\n", bodyLineOffset: 0 });
  });
});

describe("segmentDocument", () => {
  const { rows } = segment(sample);

  it("splits the document into rows with document line numbers", () => {
    expect(rows.map((row) => [row.type, row.startLine, row.endLine, row.shared])).toEqual([
      ["frontMatter", 0, 3, true],
      ["block", 4, 5, false],
      ["block", 6, 7, false],
      ["listItem", 8, 9, false],
      ["listItem", 9, 11, false],
      ["listItem", 11, 12, false],
      ["listItem", 12, 13, false],
      ["listItem", 14, 15, false],
      ["listItem", 15, 16, false],
      ["listItem", 16, 17, false],
      ["block", 18, 21, false],
      ["code", 22, 25, true],
      ["html", 28, 29, true],
      ["block", 30, 32, false],
      ["rule", 33, 34, true],
      ["block", 35, 36, true],
      ["block", 37, 38, true],
      ["block", 39, 40, false],
    ]);
  });

  it("masks code and links in units", () => {
    expect(rowAt(rows, 6).units).toEqual([
      {
        source: "Install with `npm install foo`. See [the guide](./guide.md#setup).",
        masked: "Install with ⟦1⟧. See [the guide]⟦2⟧.",
        placeholders: ["`npm install foo`", "(./guide.md#setup)"],
        translatable: true,
      },
    ]);
  });

  it("keeps nested list items inside their top-level item", () => {
    const row = rowAt(rows, 9);
    expect(row.units.map((unit) => unit.masked)).toEqual(["Second item with **bold**", "nested child"]);
    expect(row.classes).toEqual(["kind-list-item", "bullet"]);
  });

  it("numbers ordered list items as in the original list", () => {
    expect([14, 15, 16].map((line) => rowAt(rows, line).orderedStart)).toEqual([1, 2, 3]);
    expect(rowAt(rows, 14).classes).toContain("list-first");
    expect(rowAt(rows, 16).classes).toContain("list-last");
  });

  it("strips task markers from units", () => {
    expect(rowAt(rows, 11).units[0]?.masked).toBe("todo item");
  });

  it("marks table cells with nothing to translate", () => {
    expect(rowAt(rows, 18).units.map((unit) => unit.translatable)).toEqual([true, true, false, true]);
  });

  it("shares rows that are only images or already in the target language", () => {
    expect(rowAt(rows, 35).shared).toBe(true);
    expect(rowAt(rows, 37).shared).toBe(true);
    expect(segment("日本語の段落です。", "English").rows[0]?.shared).toBe(false);
  });

  it("masks reference links using the document's definitions", () => {
    expect(rowAt(rows, 39).units[0]?.masked).toBe("Use ⟦1⟧ here, or see the [docs]⟦2⟧.");
  });

  it("detects loose lists and drops comment-only HTML", () => {
    const { rows: loose } = segment("- a\n\n- b\n\n<!-- x -->\n<!-- y -->\n");
    expect(loose.map((row) => [row.type, row.tight])).toEqual([
      ["listItem", false],
      ["listItem", false],
    ]);
  });

  it("normalizes CRLF line endings", () => {
    expect(segment("# A\r\n\r\nB\r\n").rows.map((row) => [row.startLine, row.source])).toEqual([
      [0, "# A"],
      [2, "B"],
    ]);
  });
});

describe("RowRenderer", () => {
  const doc = segment(sample);
  const translate = (row: Row, texts: string[]) =>
    renderer.renderTranslation(
      row,
      doc.env,
      row.units.map((unit, k) => (texts[k] === undefined ? undefined : unmask(texts[k]!, unit.placeholders))),
    );

  it("adds GitHub-style heading ids to the source only", () => {
    const slugger = new Slugger();
    const heading = rowAt(doc.rows, 4);
    expect(renderer.renderSource(heading, doc.env, slugger)).toBe('<h1 id="getting-started">Getting Started</h1>\n');
    expect(translate(heading, ["はじめに"])).toBe("<h1>はじめに</h1>\n");
  });

  it("restores code and links in the translation", () => {
    expect(translate(rowAt(doc.rows, 6), ["⟦1⟧ でインストールします。[ガイド]⟦2⟧ を参照してください。"])).toBe(
      '<p><code>npm install foo</code> でインストールします。<a href="./guide.md#setup">ガイド</a> を参照してください。</p>\n',
    );
  });

  it("keeps list structure, numbering and task checkboxes", () => {
    expect(translate(rowAt(doc.rows, 15), ["二"])).toBe('<ol start="2">\n<li>二</li>\n</ol>\n');
    expect(translate(rowAt(doc.rows, 12), ["完了"])).toBe(
      '<ul>\n<li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox" disabled checked> 完了</li>\n</ul>\n',
    );
    expect(translate(rowAt(doc.rows, 9), ["**太字**の項目", "子"])).toContain("<li>子</li>");
  });

  it("keeps cells that were not translated and resolves reference links", () => {
    const table = translate(rowAt(doc.rows, 18), ["名前", "説明", "⟦1⟧", "最初の文字"]);
    expect(table).toContain("<th>名前</th>");
    expect(table).toContain("<td><code>a</code></td>");
    expect(translate(rowAt(doc.rows, 39), ["⟦1⟧ を使うか、[ドキュメント]⟦2⟧ を参照。"])).toBe(
      '<p><a href="https://example.com">ref</a> を使うか、<a href="https://example.com">ドキュメント</a> を参照。</p>\n',
    );
  });

  it("renders loose list items with paragraphs", () => {
    const loose = segment("- a\n\n- b\n");
    expect(renderer.renderSource(loose.rows[1]!, loose.env, new Slugger())).toBe("<ul>\n<li>\n<p>b</p>\n</li>\n</ul>\n");
  });

  it("escapes front matter", () => {
    const doc2 = segment("---\nx: <b>\n---\n");
    expect(renderer.renderSource(doc2.rows[0]!, doc2.env, new Slugger())).toBe(
      '<pre class="front-matter"><code>---\nx: &lt;b&gt;\n---</code></pre>',
    );
  });
});

describe("code comment translation", () => {
  const code = ["```js", "// Adds two numbers.", "const sum = a + b; // the result", "```"].join("\n");
  const withComments = (text: string) => segmentDocument(md, text, { targetLanguage: "Japanese", translateCodeComments: true });

  it("is off by default, so code blocks span both columns", () => {
    const [row] = segment(code).rows;
    expect([row?.type, row?.shared, row?.units]).toEqual(["code", true, []]);
  });

  it("splits the comments of a code block out for translation", () => {
    const [row] = withComments(code).rows;
    expect(row?.shared).toBe(false);
    expect(row?.units.map((unit) => [unit.masked, unit.comment?.block])).toEqual([
      ["Adds two numbers.", 0],
      ["the result", 0],
    ]);
  });

  it("shares code blocks whose comments have nothing to translate", () => {
    const [row] = withComments(["```ts", '/// <reference types="node" />', "// 日本語のコメントです。", "let x = 1;", "```"].join("\n")).rows;
    expect(row?.shared).toBe(true);
    expect(row?.units).toEqual([]);
  });

  it("masks code in comments but does not read brackets as links", () => {
    const doc = withComments(["[x]: https://example.com", "", "```c", "// see [x] and `f()`", "```"].join("\n"));
    expect(doc.rows.at(-1)?.units[0]).toMatchObject({ masked: "see [x] and ⟦1⟧", placeholders: ["`f()`"] });
  });

  it("renders the code with its comments translated", () => {
    const doc = withComments(code);
    const row = doc.rows[0]!;
    expect(renderer.renderTranslation(row, doc.env, ["2 つの数を足します。", "結果"])).toBe(
      '<pre><code class="language-js">// 2 つの数を足します。\nconst sum = a + b; // 結果\n</code></pre>\n',
    );
    expect(renderer.renderTranslation(row, doc.env, [undefined, "結果"])).toContain("// Adds two numbers.\n");
  });

  it("finds comments in code blocks inside list items", () => {
    const doc = withComments(["- Run:", "", "  ```sh", "  # Install it", "  npm i", "  ```"].join("\n"));
    const row = doc.rows[0]!;
    expect(row.units.map((unit) => [unit.masked, unit.comment?.block])).toEqual([
      ["Run:", undefined],
      ["Install it", 0],
    ]);
    const html = renderer.renderTranslation(row, doc.env, ["実行:", "インストールする"]);
    expect(html).toContain("<p>実行:</p>");
    expect(html).toContain('<pre><code class="language-sh"># インストールする\nnpm i\n</code></pre>');
  });
});

describe("Slugger", () => {
  it("makes GitHub-style unique slugs", () => {
    const slugger = new Slugger();
    expect(["Hello, World!", "Hello World", "Hello World", "日本語 の 見出し", "`code()` call"].map((text) => slugger.slug(text))).toEqual([
      "hello-world",
      "hello-world-1",
      "hello-world-2",
      "日本語-の-見出し",
      "code-call",
    ]);
  });
});
