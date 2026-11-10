# Bilingual Markdown Preview

[日本語](README.ja.md)

Preview Markdown with an LLM translation beside it, block by block. Translation uses your own API key (BYOK) for **Claude Haiku 5.5** (`claude-haiku-5-5`) or **GPT-6 Luna** (`gpt-6-luna`).

![An English document on the left and its Japanese translation on the right, lined up block by block](images/screenshot.png)

## Features

- Translates headings, paragraphs, list items, table cells and block quotes one block at a time, and lines each translation up with its source.
- Leaves code blocks, front matter, image-only paragraphs and paragraphs already in the target language untranslated, and shows them across both columns.
- Can also translate the comments in code blocks, and show the code with its comments translated beside the original. Only the comment text is sent.
- Switches between Source, Side by side and Translation from the toolbar. The editor and the preview scroll together.
- Translates what is on screen first, and shows each translation as it arrives.
- Sends inline code, URLs, link targets and HTML as placeholders such as `⟦1⟧`, and puts them back unchanged. A translation that drops a placeholder is translated again automatically; if it still fails, the row shows a warning.
- Caches translations on your computer (up to 20,000 entries). After an edit, only the blocks that changed are translated again.
- Japanese translations use the polite です・ます style unless your style instructions say otherwise. A glossary fixes the translation of terms.
- In a narrow panel, the translation goes under the source.
- The interface is in English and Japanese.

## Getting started

You need VS Code 1.101 or later and an API key from Anthropic or OpenAI.

1. Install **Bilingual Markdown Preview** from the Visual Studio Marketplace.
2. Open a Markdown file and click the globe icon (**Open Bilingual Preview to the Side**) at the top right of the editor. You can also right-click the file in the Explorer, or run **Bilingual Markdown: Open Bilingual Preview** from the Command Palette.
3. The first time, the preview asks for an API key. Click **Set API Key** and enter the key.
4. Translation starts. If a row fails, click **Retry** on that row.

The preview translates into Japanese. To translate into another language, set `bilingualMarkdown.targetLanguage`, for example to `English` or `Simplified Chinese`.

## Commands

| Command | What it does |
| --- | --- |
| Bilingual Markdown: Open Bilingual Preview | Opens the preview. |
| Bilingual Markdown: Open Bilingual Preview to the Side | Opens the preview beside the editor. |
| Bilingual Markdown: Retranslate (Ignore Cache) | Translates the document in the preview again, without the cache. |
| Bilingual Markdown: Set API Key | Stores an API key. |
| Bilingual Markdown: Clear API Key | Deletes a stored API key. |
| Bilingual Markdown: Switch Translation Provider | Switches between Anthropic and OpenAI. |
| Bilingual Markdown: Clear Translation Cache | Deletes the cached translations. |

## API keys and cost

- Anthropic and OpenAI are supported. Translation is billed to the account that issued the key.
- You enter the key in a password box. It is kept in VS Code Secret Storage (your OS keychain), never in `settings.json`.
- If the provider rejects the key (an authentication or permission error), translation stops, and the preview offers to set the key again or to switch providers.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `bilingualMarkdown.provider` | `anthropic` | Translation provider: `anthropic` or `openai`. |
| `bilingualMarkdown.targetLanguage` | `Japanese` | Language to translate into, written as you would tell a translator, such as `English` or `Simplified Chinese`. |
| `bilingualMarkdown.anthropic.model` | `claude-haiku-5-5` | Anthropic model ID. |
| `bilingualMarkdown.openai.model` | `gpt-6-luna` | OpenAI model ID. |
| `bilingualMarkdown.openai.baseUrl` | (empty) | Base URL of an OpenAI-compatible API, such as a company gateway. Empty means `https://api.openai.com/v1`. Only `https://` URLs, and `http://` URLs to `localhost`, `127.0.0.1` or `[::1]`, are accepted. |
| `bilingualMarkdown.reasoningEffort` | `none` | How much the model reasons before it answers: `none`, `low`, `medium`, `high` or `default`. `none` is usually enough for translation. |
| `bilingualMarkdown.styleInstructions` | (empty) | Extra instructions for the translator, such as `Use the plain である style.` |
| `bilingualMarkdown.glossary` | `{}` | Fixed translations for terms, such as `{ "pull request": "プルリクエスト" }`. |
| `bilingualMarkdown.translateCodeComments` | `false` | Also translate the comments in code blocks. See [Translating code comments](#translating-code-comments). |
| `bilingualMarkdown.maxConcurrentRequests` | `3` | Maximum number of translation requests in flight at once (1–8). |
| `bilingualMarkdown.batchCharacterLimit` | `4000` | Approximate number of source characters in one request (500–20000). |
| `bilingualMarkdown.syncScroll` | `true` | Keeps the editor and the preview scrolled to the same place. |

The provider, the models, the base URL, the reasoning effort, the number of requests and the request size can be changed only in your user settings. A workspace's settings do not change them.

## Translating code comments

Turn on `bilingualMarkdown.translateCodeComments` to translate the comments in code blocks too. A code block with comments then shows the original code on the left and the code with its comments translated on the right.

![A JavaScript function with English comments beside the same function with its comments in Japanese](images/code-comments.png)

- Only the comment text is sent, never the code. A `//` or `#` inside a string is not taken for a comment.
- A comment that spans several lines is translated as one passage and wrapped to the width of the original comment. A comment at the end of a line stays on one line.
- Comments that tools read, such as `eslint-disable`, `@ts-ignore`, `# noqa` and `//go:build`, are not translated, and neither are comments already in the target language.
- The code block's language must be named after its opening fence, as in ```` ```python ````. These languages are supported:
  - `//` and `/* */`: JavaScript, TypeScript, C, C++, C#, Java, Kotlin, Scala, Swift, Dart, Go, Rust, PHP, Protocol Buffers, JSON with comments
  - `#`: Python, Ruby, Perl, R, Elixir, shells (sh, bash, zsh and others), PowerShell, YAML, TOML, Dockerfile, Makefile, CMake, Terraform (HCL), GraphQL, nginx
  - Others: CSS, SCSS, Less, SQL, Lua, Haskell, Clojure and other Lisps, INI, HTML, XML

## Security and privacy

- The text to translate is sent only to the provider you choose: `https://api.anthropic.com`, `https://api.openai.com/v1`, or the `bilingualMarkdown.openai.baseUrl` in your user settings. Environment variables such as `ANTHROPIC_BASE_URL`, `OPENAI_BASE_URL`, `OPENAI_ORG_ID` and `OPENAI_PROJECT_ID` are not used.
- Code blocks, front matter, inline code, URLs, link targets and HTML are not sent. With `bilingualMarkdown.translateCodeComments` on, the text of the comments in code blocks is sent.
- In Restricted Mode (an untrusted workspace), the target language, style instructions, glossary and code comment translation also come only from your user settings.
- The extension collects no telemetry.
- The preview runs under a strict Content Security Policy, and HTML in the Markdown is sanitized with DOMPurify. Scripts and command URIs in a document never run.
- `http`, `https` and `mailto` links open in your browser or mail app, and relative links open in VS Code. Links with other schemes do not open.

## Known limitations

- Markdown inside an HTML block such as `<details>` is shown as separate rows, one per block, and cannot be folded.
- Text already in the target language is recognized only when translating into Japanese. For other languages, such paragraphs and comments are sent for translation too.
- Math and Mermaid diagrams are shown as written, not rendered.
- Comment translation does not translate Python docstrings or other text in strings, or the comments in indented code blocks and in code blocks without a language.

## Contributing

Bug reports and pull requests are welcome on [GitHub](https://github.com/yhay81/bilingual-markdown-preview/issues). [CONTRIBUTING.md](CONTRIBUTING.md) explains how to build and test the extension.

## License

[MIT](LICENSE). The licenses of the third-party libraries bundled with the extension are in `dist/ThirdPartyNotices.txt` inside the package.
