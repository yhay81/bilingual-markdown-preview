import type { Env, MarkdownIt, Token } from "markdown-it";
import { spliceComments, type CommentEdit } from "./codeComments";
import { fencesOf, forkEnv, inlineTokensOf, type Row } from "./segment";
import type { Slugger } from "./slug";

/**
 * Renders one row as HTML. The translation is rendered from the row's own token tree with each
 * inline token's children replaced by the parsed translation, so block structure (lists, tables,
 * quotes) is identical on both sides. Translated code comments are written into the code of their
 * fenced code blocks.
 */
export class RowRenderer {
  constructor(private readonly md: MarkdownIt) {}

  renderSource(row: Row, env: Env, slugger: Slugger): string {
    if (row.type === "frontMatter") {
      return `<pre class="front-matter"><code>${this.md.utils.escapeHtml(row.source)}</code></pre>`;
    }
    const rowEnv = forkEnv(env);
    const tokens = this.parse(row, rowEnv);
    for (let i = 0; i < tokens.length; i++) {
      const inline = tokens[i + 1];
      if (tokens[i]!.type === "heading_open" && inline?.type === "inline") {
        tokens[i]!.attrSet("id", slugger.slug(plainText(inline.children ?? [])));
      }
    }
    return this.md.renderer.render(tokens, this.md.options, rowEnv);
  }

  /** `texts[k]` is the translation of unit k (inline Markdown, or a comment's plain text), or undefined to keep the source. */
  renderTranslation(row: Row, env: Env, texts: ReadonlyArray<string | undefined>): string {
    const rowEnv = forkEnv(env);
    const tokens = this.parse(row, rowEnv);
    const inlines = inlineTokensOf(tokens);
    const edits = new Map<number, CommentEdit[]>();
    let nextInline = 0;
    row.units.forEach((unit, k) => {
      const text = texts[k];
      if (unit.comment) {
        if (text !== undefined) edits.set(unit.comment.block, [...(edits.get(unit.comment.block) ?? []), { slot: unit.comment.slot, text }]);
        return;
      }
      const inline = inlines[nextInline++];
      if (!inline || text === undefined) return;
      const children = this.md.parseInline(text, forkEnv(env))[0]?.children ?? [];
      const checkbox = inline.meta?.task ? inline.children?.[0] : undefined;
      if (checkbox) children.unshift(checkbox);
      inline.children = children;
      inline.content = text;
    });
    const fences = fencesOf(tokens);
    for (const [block, blockEdits] of edits) {
      const fence = fences[block];
      if (fence) fence.content = spliceComments(fence.content, blockEdits);
    }
    return this.md.renderer.render(tokens, this.md.options, rowEnv);
  }

  private parse(row: Row, env: Env): Token[] {
    const tokens = this.md.parse(row.source, env);
    if (row.type !== "listItem") return tokens;
    const list = tokens[0];
    if (list?.type === "ordered_list_open" && row.orderedStart !== undefined) {
      // Each item is parsed on its own, so restore its number in the original list.
      if (row.orderedStart === 1) list.attrs = list.attrs?.filter(([name]) => name !== "start") ?? null;
      else list.attrSet("start", row.orderedStart);
    }
    if (row.tight !== undefined) {
      for (const token of tokens) {
        if ((token.type === "paragraph_open" || token.type === "paragraph_close") && token.level === 2) {
          token.hidden = row.tight;
        }
      }
    }
    return tokens;
  }
}

/** Heading text for anchors: like GitHub, it includes code spans and drops HTML tags. */
function plainText(tokens: readonly Token[]): string {
  let text = "";
  for (const token of tokens) {
    if (token.type === "text" || token.type === "code_inline") text += token.content;
    else if (token.type === "image") text += plainText(token.children ?? []);
    else if (token.type === "softbreak" || token.type === "hardbreak") text += " ";
  }
  return text;
}
