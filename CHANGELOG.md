# Changelog

## Unreleased

- Translate with GitHub Copilot or another language model in VS Code, with no API key (`bilingualMarkdown.provider`: `vscode`). **Bilingual Markdown: Choose VS Code Language Model** picks the model.
- Translate with a local model: a server on this machine, such as Ollama or LM Studio, needs no API key.
- Save the translation as a Markdown file, such as `README.ja.md`, from the toolbar or with **Bilingual Markdown: Save Translation as Markdown**.
- Correct a translation by hand in the preview. Edits are kept and can be reverted.
- A glossary file shared by the workspace: `.vscode/translation-glossary.json`.
- A document can choose its target language with `translate-to` in its front matter.
- The toolbar shows the tokens used, and `bilingualMarkdown.tokenLimit` pauses translation after that many.
- Each request carries the text just before it, for consistent terms and tone.
- Math is rendered with KaTeX and Mermaid diagrams are drawn. `<details>` blocks fold on both sides, and their summaries are translated.
- Text already in the target language is now recognized for Chinese, Korean, Russian, Ukrainian, Greek, Arabic, Hebrew, Thai, Hindi, English, Spanish, French, German, Portuguese and Italian too, not only Japanese.
- An interface in Simplified Chinese and Korean.
- Translations made by earlier versions are translated again once, because the prompt changed.

## 0.1.0

The first release.

- A preview that shows Markdown and its translation side by side, block by block. The toolbar switches between the source, both, and the translation alone. The editor and the preview scroll together, and in a narrow panel the translation goes under the source.
- Translation with your own API key: Anthropic (`claude-haiku-5-5`) or OpenAI (`gpt-6-luna`, or any OpenAI-compatible base URL). Keys are kept in VS Code Secret Storage.
- Streaming translation that starts with what is on screen, automatic retranslation when a translation drops a placeholder, and a Retry button on each row.
- Translation of the comments in code blocks, shown beside the original code (`bilingualMarkdown.translateCodeComments`, off by default). Only the comment text is sent.
- A cache of translations, a glossary, and style instructions for the translator.
- An interface in English and Japanese.
