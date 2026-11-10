import katex from "@vscode/markdown-it-katex";
import markdownIt from "markdown-it";
import type { MarkdownIt, StateCore, Token } from "markdown-it";

const TASK_MARKER_RE = /^\[([ xX])\](?=\s|$)\s*/;

export interface TaskMeta {
  checked: boolean;
}

/** The parser shared by segmentation and rendering. Both must use the same instance and options. */
export function createMarkdownEngine(): MarkdownIt {
  const md = markdownIt({ html: true, linkify: true, typographer: false, breaks: false });
  md.core.ruler.push("bilingual_task_lists", taskLists);
  // `$…$` and `$$…$$`, as in VS Code's own Markdown preview.
  md.use(katex, { throwOnError: false });
  mermaidFences(md);
  return md;
}

/** Info string of the fenced code blocks drawn as diagrams. */
export const MERMAID_INFO = "mermaid";

/** Mermaid diagrams are written out as their source; the webview draws them. */
function mermaidFences(md: MarkdownIt): void {
  const fence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens: Token[], idx, options, env, self) => {
    const token = tokens[idx]!;
    if (token.info.trim().split(/\s+/)[0]?.toLowerCase() !== MERMAID_INFO) return fence(tokens, idx, options, env, self);
    return `<pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre>\n`;
  };
}

/**
 * GitHub task list items (`- [ ] todo`). The marker is removed from the inline content, so it is
 * never sent for translation, and rendered as a disabled checkbox instead.
 */
function taskLists(state: StateCore): void {
  const tokens = state.tokens;
  for (let i = 2; i < tokens.length; i++) {
    const inline = tokens[i]!;
    if (inline.type !== "inline" || tokens[i - 1]!.type !== "paragraph_open" || tokens[i - 2]!.type !== "list_item_open") {
      continue;
    }
    const first = inline.children?.[0];
    const contentMatch = TASK_MARKER_RE.exec(inline.content);
    const textMatch = first?.type === "text" ? TASK_MARKER_RE.exec(first.content) : null;
    if (!first || !contentMatch || !textMatch) continue;

    const checked = contentMatch[1] !== " ";
    inline.content = inline.content.slice(contentMatch[0].length);
    first.content = first.content.slice(textMatch[0].length);
    const checkbox = new state.Token("html_inline", "", 0);
    checkbox.content = `<input type="checkbox" class="task-list-item-checkbox" disabled${checked ? " checked" : ""}> `;
    inline.children!.unshift(checkbox);
    inline.meta = { ...inline.meta, task: { checked } satisfies TaskMeta };
    tokens[i - 2]!.attrJoin("class", "task-list-item");
  }
}
