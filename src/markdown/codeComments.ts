import { displayWidth, joinLines, wrapLine } from "./wrap";

/**
 * Comments in fenced code blocks.
 *
 * When comment translation is on, the preview shows a copy of each code block with its comments
 * translated beside the original. Only the comment text is sent for translation, never the code.
 * A small lexer per language family finds the comments and skips strings, so the `//` in
 * `"https://…"` is not taken for one. Blocks without a language, or in a language not listed
 * here, are left alone.
 */

/** Where a comment's text sits in its code, and how a translation is written back in its place. */
export interface CommentSlot {
  /** Offsets of the text in the code (end exclusive), without the markers and line prefixes around it. */
  start: number;
  end: number;
  /** Written before each further line of a translation, e.g. `    // ` or `   * `. */
  linePrefix: string;
  /** False when the comment shares its line with code, so a translation must stay on one line. */
  multiline: boolean;
  /** Closing delimiter of a block comment, which a translation must not contain. */
  close?: string;
  /** Comments written over several lines: the width to rewrap translated lines to. */
  wrapWidth?: number;
}

export interface CodeComment {
  /** Markers, line prefixes and common indentation removed; lines joined with "\n". */
  text: string;
  slot: CommentSlot;
}

export interface CommentEdit {
  slot: CommentSlot;
  /** The comment's new text, as plain text without markers. */
  text: string;
}

interface Literal {
  open: string;
  close: string;
  /** No escapes inside, as in Go's raw strings. */
  raw?: boolean;
}

interface Syntax {
  /** Line comment markers. */
  line: readonly string[];
  /** Block comment delimiters; checked before the line markers. */
  block: ReadonlyArray<readonly [open: string, close: string]>;
  /** Quote characters of strings. A string that is not closed ends with its line. */
  quotes: string;
  /** Strings that may span lines, such as Python's triple quotes; checked first. */
  literals?: readonly Literal[];
  /** Escape character, or null for none. Defaults to a backslash. */
  escape?: string | null;
  /** A line marker counts only at a line's start or after whitespace, so `$#` and `${#a}` in shells are not comments. */
  markerAfterSpace?: boolean;
  /** A line marker counts only as the first thing on its line (INI). */
  markerAtLineStart?: boolean;
  /** `'` opens only a character literal such as `'a'`, not a lifetime such as `'a`. */
  charLiterals?: boolean;
  /** Text at a line marker that does not start a comment, such as PHP attributes `#[...]`. */
  notComments?: readonly string[];
}

const C_STYLE: Syntax = { line: ["//"], block: [["/*", "*/"]], quotes: `"'`, literals: [{ open: '"""', close: '"""' }] };
const JS: Syntax = { line: ["//"], block: [["/*", "*/"]], quotes: `"'`, literals: [{ open: "`", close: "`" }] };
const GO: Syntax = { line: ["//"], block: [["/*", "*/"]], quotes: `"'`, literals: [{ open: "`", close: "`", raw: true }] };
const RUST: Syntax = {
  line: ["//"],
  block: [["/*", "*/"]],
  quotes: "'",
  literals: [{ open: 'r#"', close: '"#', raw: true }, { open: 'r"', close: '"', raw: true }, { open: '"', close: '"' }],
  charLiterals: true,
};
const PHP: Syntax = { line: ["//", "#"], block: [["/*", "*/"]], quotes: `"'`, notComments: ["#["] };
const CSS: Syntax = { line: [], block: [["/*", "*/"]], quotes: `"'` };
const SCSS: Syntax = { line: ["//"], block: [["/*", "*/"]], quotes: `"'`, literals: [{ open: "url(", close: ")", raw: true }] };
const TRIPLE_QUOTES: readonly Literal[] = [
  { open: '"""', close: '"""' },
  { open: "'''", close: "'''" },
];
const PYTHON: Syntax = { line: ["#"], block: [], quotes: `"'`, literals: TRIPLE_QUOTES };
const HASH: Syntax = { line: ["#"], block: [], quotes: `"'`, markerAfterSpace: true };
const ELIXIR: Syntax = { ...HASH, literals: TRIPLE_QUOTES };
const TOML: Syntax = { line: ["#"], block: [], quotes: `"'`, literals: [{ open: '"""', close: '"""' }, { open: "'''", close: "'''", raw: true }] };
const SHELL: Syntax = { line: ["#"], block: [], quotes: "\"'`", markerAfterSpace: true };
const POWERSHELL: Syntax = { line: ["#"], block: [["<#", "#>"]], quotes: `"'`, escape: "`", markerAfterSpace: true };
const HCL: Syntax = { line: ["#", "//"], block: [["/*", "*/"]], quotes: `"`, markerAfterSpace: true };
const INI: Syntax = { line: [";", "#"], block: [], quotes: "", markerAtLineStart: true };
const SQL: Syntax = { line: ["--"], block: [["/*", "*/"]], quotes: "\"'`", escape: null };
const LUA: Syntax = { line: ["--"], block: [["--[[", "]]"]], quotes: `"'`, literals: [{ open: "[[", close: "]]", raw: true }] };
const HASKELL: Syntax = { line: ["--"], block: [["{-", "-}"]], quotes: `"`, literals: [{ open: "{-#", close: "#-}", raw: true }] };
const LISP: Syntax = { line: [";"], block: [], quotes: `"` };
const HTML: Syntax = { line: [], block: [["<!--", "-->"]], quotes: "" };

const SYNTAX_BY_LANGUAGE = new Map<string, Syntax>();
for (const [syntax, names] of [
  [JS, "javascript js jsx mjs cjs typescript ts tsx mts cts"],
  [C_STYLE, "c h cpp c++ cc cxx hpp hxx cs csharp c# java kotlin kt kts scala swift dart groovy gradle objc objective-c objectivec proto protobuf solidity json jsonc json5"],
  [GO, "go golang"],
  [RUST, "rust rs"],
  [PHP, "php"],
  [CSS, "css"],
  [SCSS, "scss sass less stylus styl"],
  [PYTHON, "python py python3 py3"],
  [HASH, "ruby rb perl pl r yaml yml dockerfile docker containerfile makefile make mk cmake nginx graphql gql conf"],
  [ELIXIR, "elixir ex exs"],
  [TOML, "toml"],
  [SHELL, "sh bash zsh shell ksh fish dash shellscript"],
  [POWERSHELL, "powershell ps1 pwsh"],
  [HCL, "hcl terraform tf tfvars"],
  [INI, "ini cfg"],
  [SQL, "sql mysql postgresql postgres psql pgsql plsql sqlite tsql"],
  [LUA, "lua"],
  [HASKELL, "haskell hs elm purescript"],
  [LISP, "clojure clj cljs lisp scheme racket elisp emacs-lisp"],
  [HTML, "html htm xhtml xml svg"],
] as const) {
  for (const name of names.split(" ")) SYNTAX_BY_LANGUAGE.set(name, syntax);
}

/** Comments that tools read: there is nothing to translate, and changing them would change what the code does. */
const DIRECTIVE_RE = new RegExp(
  `^(?:${[
    String.raw`@ts-\w`,
    String.raw`@(?:flow|jsx\w*|refresh|license|preserve|vite-ignore|(?:jest|vitest)-environment)\b`,
    String.raw`@(?:type|typedef|satisfies)\s*\{`,
    String.raw`[a-z-]*(?:lint|prettier|biome|dprint)[a-z-]*[-:](?:ignore|disable|enable)`,
    String.raw`eslint(?:-env)?\s`,
    String.raw`(?:istanbul|c8|v8) ignore\b`,
    String.raw`(?:pylint|mypy|pyright|ruff|isort|rubocop|swiftlint|cspell|spell-checker|checkov|codespell|jshint|jscs|fmt|tslint|yaml-language-server):`,
    String.raw`#?(?:noqa|nosec|NOLINT\w*|NOSONAR|nolint)\b`,
    String.raw`(?:shellcheck|hadolint|yamllint) (?:disable|enable|ignore|source|shell)\b`,
    String.raw`type: ?ignore\b`,
    String.raw`pragma: no (?:cover|branch)\b`,
    String.raw`frozen_string_literal:`,
    String.raw`typed: (?:ignore|false|true|strict|strong)\b`,
    String.raw`(?:en)?coding[:=]`,
    String.raw`-\*-`,
    String.raw`vim?:`,
    String.raw`go:[a-z]`,
    String.raw`\+build\b`,
    String.raw`#?(?:end)?region\b`,
    String.raw`SPDX-License-Identifier:`,
    String.raw`webpack[A-Z]\w*:`,
    String.raw`[#@]__[A-Z_]+__`,
    // Dockerfile parser directives.
    String.raw`(?:syntax|escape|check)=`,
    String.raw`clang-format (?:on|off)\b`,
  ].join("|")})`,
);

const CHAR_LITERAL_RE = /^'(?:\\(?:x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]{1,6}\}|.)|[^\\'\n])'/u;
/** Comments written over several lines are rewrapped to their own width, but never narrower than this. */
const MIN_WRAP_WIDTH = 40;

/** The syntax named by a fence's info string (`js`, `{.python}`, `ts title="a.ts"`), if it is one we know. */
function syntaxOf(info: string): Syntax | undefined {
  const name = info.trim().replace(/^\{\s*\.?/, "").split(/[\s{}:,]/)[0]?.toLowerCase();
  return name ? SYNTAX_BY_LANGUAGE.get(name) : undefined;
}

/** Comments in `code` that can be translated, in order. Directives and empty comments are left out. */
export function findComments(code: string, info: string): CodeComment[] {
  const syntax = syntaxOf(info);
  if (!syntax) return [];
  const comments: CodeComment[] = [];
  let group: RawComment[] = [];
  const flush = (): void => {
    const comment = group.length > 0 ? lineGroupComment(code, group) : undefined;
    if (comment) comments.push(comment);
    group = [];
  };

  for (const raw of scan(code, syntax)) {
    if (raw.type === "line" && isWholeLine(code, raw)) {
      // A directive between comment lines ends the comment above it and stays as written.
      const last = group.at(-1);
      if (isDirective(code.slice(raw.bodyStart, raw.bodyEnd).trim())) {
        flush();
      } else {
        if (last && !continuesGroup(code, last, raw)) flush();
        group.push(raw);
      }
      continue;
    }
    flush();
    const comment = raw.type === "line" ? trailingComment(code, raw) : blockComment(code, raw);
    if (comment && !isDirective(comment.text)) comments.push(comment);
  }
  flush();
  return comments;
}

/** Writes translations over their comments, keeping each comment's markers, prefixes and indentation. */
export function spliceComments(code: string, edits: readonly CommentEdit[]): string {
  let out = "";
  let at = 0;
  for (const { slot, text } of [...edits].sort((a, b) => a.slot.start - b.slot.start)) {
    if (slot.start < at || slot.end > code.length) continue;
    out += code.slice(at, slot.start) + formatComment(slot, text);
    at = slot.end;
  }
  return out + code.slice(at);
}

function formatComment(slot: CommentSlot, text: string): string {
  let lines = text.split("\n").map((line) => line.trimEnd());
  const close = slot.close;
  if (close) {
    // Keep the translation from ending the comment early, e.g. "*/" becomes "* /".
    const broken = `${close.slice(0, -1)} ${close.slice(-1)}`;
    lines = lines.map((line) => line.split(close).join(broken));
  }
  if (!slot.multiline) return joinLines(lines);
  const width = slot.wrapWidth;
  if (width !== undefined) lines = lines.flatMap((line) => wrapLine(line, width));
  return lines.map((line, k) => (k === 0 ? line : line === "" ? slot.linePrefix.trimEnd() : slot.linePrefix + line)).join("\n");
}

function isDirective(text: string): boolean {
  return DIRECTIVE_RE.test(text);
}

interface RawComment {
  type: "line" | "block";
  /** Offset of the opening marker. */
  start: number;
  /** The comment's body: after the marker, up to the closing delimiter or the line's end. */
  bodyStart: number;
  bodyEnd: number;
  /** After the closing delimiter, or the line's end. */
  end: number;
  /** The line marker as written, with doc markers such as `///` and `##`; or the block comment's opening delimiter. */
  marker: string;
  close?: string;
}

function scan(code: string, syntax: Syntax): RawComment[] {
  const comments: RawComment[] = [];
  const escape = syntax.escape === undefined ? "\\" : syntax.escape;
  // A shebang line is not a comment to translate.
  let i = code.startsWith("#!") ? lineEndOf(code, 0) : 0;
  scanning: while (i < code.length) {
    for (const literal of syntax.literals ?? []) {
      if (code.startsWith(literal.open, i)) {
        i = skipString(code, i + literal.open.length, literal.close, literal.raw ? null : escape, false);
        continue scanning;
      }
    }
    for (const [open, close] of syntax.block) {
      if (code.startsWith(open, i)) {
        const closeAt = code.indexOf(close, i + open.length);
        const bodyEnd = closeAt < 0 ? code.length : closeAt;
        const end = closeAt < 0 ? code.length : closeAt + close.length;
        comments.push({ type: "block", start: i, bodyStart: i + open.length, bodyEnd, end, marker: open, close });
        i = end;
        continue scanning;
      }
    }
    for (const marker of syntax.line) {
      if (code.startsWith(marker, i) && startsLineComment(code, i, syntax)) {
        const end = lineEndOf(code, i);
        let bodyStart = i + marker.length;
        // Doc comment markers such as `///`, `//!`, `##`, `#'` and `---` belong to the marker.
        while (bodyStart < end && code[bodyStart] === marker.at(-1)) bodyStart++;
        if (code[bodyStart] === "!" || (code[bodyStart] === "'" && marker === "#")) bodyStart++;
        comments.push({ type: "line", start: i, bodyStart, bodyEnd: end, end, marker: code.slice(i, bodyStart) });
        i = end;
        continue scanning;
      }
    }
    const ch = code[i]!;
    if (ch === escape) {
      i += 2;
    } else if (syntax.quotes.includes(ch) && !(ch === "'" && syntax.charLiterals && !CHAR_LITERAL_RE.test(code.slice(i, i + 16)))) {
      i = skipString(code, i + 1, ch, escape, true);
    } else {
      i++;
    }
  }
  return comments;
}

function startsLineComment(code: string, at: number, syntax: Syntax): boolean {
  if (syntax.notComments?.some((text) => code.startsWith(text, at))) return false;
  const before = code.slice(lineStartOf(code, at), at);
  if (syntax.markerAtLineStart) return before.trim() === "";
  if (syntax.markerAfterSpace) return before === "" || /\s$/.test(before);
  return true;
}

/** Offset after the string that starts at `from`; a single-line string also ends at the line break. */
function skipString(code: string, from: number, close: string, escape: string | null, singleLine: boolean): number {
  for (let j = from; j < code.length; j++) {
    const ch = code[j];
    if (ch === escape) {
      j++;
    } else if (singleLine && ch === "\n") {
      return j;
    } else if (code.startsWith(close, j)) {
      return j + close.length;
    }
  }
  return code.length;
}

function isWholeLine(code: string, raw: RawComment): boolean {
  return code.slice(lineStartOf(code, raw.start), raw.start).trim() === "";
}

/** Whole-line comments on consecutive lines, with the same marker in the same column, read as one comment. */
function continuesGroup(code: string, last: RawComment, next: RawComment): boolean {
  return (
    next.marker === last.marker &&
    lineStartOf(code, next.start) === last.end + 1 &&
    next.start - (last.end + 1) === last.start - lineStartOf(code, last.start)
  );
}

function lineGroupComment(code: string, group: readonly RawComment[]): CodeComment | undefined {
  const bodies = group.map((raw) => code.slice(raw.bodyStart, raw.bodyEnd).trimEnd());
  const first = bodies.findIndex((body) => body !== "");
  if (first < 0) return undefined;
  const last = bodies.findLastIndex((body) => body !== "");
  // Blank comment lines around the text stay as they are; the space after the marker is kept as written.
  const kept = bodies.slice(first, last + 1);
  const gap = Math.min(...kept.filter((body) => body !== "").map(leadingSpace));
  const lines = kept.map((body) => body.slice(gap));
  const head = group[first]!;
  const tail = group[last]!;
  return {
    text: lines.join("\n"),
    slot: {
      start: head.bodyStart + gap,
      end: tail.bodyStart + bodies[last]!.length,
      linePrefix: code.slice(lineStartOf(code, head.start), head.bodyStart + gap),
      multiline: true,
      wrapWidth: wrapWidthOf(lines),
    },
  };
}

function trailingComment(code: string, raw: RawComment): CodeComment | undefined {
  const body = code.slice(raw.bodyStart, raw.bodyEnd).trimEnd();
  const gap = leadingSpace(body);
  if (body.length === gap) return undefined;
  return {
    text: body.slice(gap),
    slot: { start: raw.bodyStart + gap, end: raw.bodyStart + body.length, linePrefix: "", multiline: false },
  };
}

function blockComment(code: string, raw: RawComment): CodeComment | undefined {
  const starred = raw.marker === "/*";
  let bodyStart = raw.bodyStart;
  if (starred) {
    // Doc comment openers such as `/**` and `/*!`.
    while (bodyStart < raw.bodyEnd && code[bodyStart] === "*") bodyStart++;
    if (bodyStart < raw.bodyEnd && code[bodyStart] === "!") bodyStart++;
  }

  const lines: Array<{ start: number; end: number }> = [];
  for (let at = bodyStart; ; ) {
    const lineBreak = code.indexOf("\n", at);
    if (lineBreak < 0 || lineBreak >= raw.bodyEnd) {
      lines.push({ start: at, end: raw.bodyEnd });
      break;
    }
    lines.push({ start: at, end: lineBreak });
    at = lineBreak + 1;
  }
  const textOf = (line: { start: number; end: number }): string => code.slice(line.start, line.end);
  const following = lines.slice(1).filter((line) => textOf(line).trim() !== "");
  // JSDoc and the like: every line after the first starts with " * ".
  const stars = starred && following.length > 0 && following.every((line) => /^[ \t]*\*/.test(textOf(line)));
  const indent = following.length > 0 ? Math.min(...following.map((line) => leadingSpace(textOf(line)))) : 0;

  const texts = lines.map((line, k) => {
    const raw = textOf(line);
    const skip = k === 0 ? leadingSpace(raw) : stars ? (/^[ \t]*\* ?/.exec(raw)?.[0].length ?? raw.length) : Math.min(indent, raw.length);
    const text = raw.slice(skip).trimEnd();
    return { text, start: line.start + skip, end: line.start + skip + text.length };
  });
  const first = texts.findIndex((line) => line.text !== "");
  if (first < 0) return undefined;
  const last = texts.findLastIndex((line) => line.text !== "");
  const kept = texts.slice(first, last + 1).map((line) => line.text);

  // Further lines of a translation look like the comment's own further lines, or line up under its text.
  const sample = texts.find((line, k) => k > 0 && line.text !== "");
  const head = texts[first]!;
  const linePrefix = sample
    ? code.slice(lineStartOf(code, sample.start), sample.start)
    : code.slice(lineStartOf(code, head.start), head.start).replace(/[^\t]/g, " ");
  const codeBefore = code.slice(lineStartOf(code, raw.start), raw.start).trim() !== "";
  const codeAfter = code.slice(raw.end, lineEndOf(code, raw.end)).trim() !== "";
  return {
    text: kept.join("\n"),
    slot: {
      start: head.start,
      end: texts[last]!.end,
      linePrefix,
      multiline: lines.length > 1 || (!codeBefore && !codeAfter),
      close: raw.close,
      wrapWidth: wrapWidthOf(kept),
    },
  };
}

function wrapWidthOf(lines: readonly string[]): number | undefined {
  return lines.length > 1 ? Math.max(MIN_WRAP_WIDTH, ...lines.map(displayWidth)) : undefined;
}

function leadingSpace(text: string): number {
  return /^[ \t]*/.exec(text)![0].length;
}

function lineStartOf(code: string, offset: number): number {
  return offset === 0 ? 0 : code.lastIndexOf("\n", offset - 1) + 1;
}

function lineEndOf(code: string, offset: number): number {
  const lineBreak = code.indexOf("\n", offset);
  return lineBreak < 0 ? code.length : lineBreak;
}
