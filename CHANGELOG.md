# Changelog

## 0.1.0

The first release.

- A preview that shows Markdown and its translation side by side, block by block. The toolbar switches between the source, both, and the translation alone. The editor and the preview scroll together, and in a narrow panel the translation goes under the source.
- Translation with your own API key: Anthropic (`claude-haiku-5-5`) or OpenAI (`gpt-6-luna`, or any OpenAI-compatible base URL). Keys are kept in VS Code Secret Storage.
- Streaming translation that starts with what is on screen, automatic retranslation when a translation drops a placeholder, and a Retry button on each row.
- Translation of the comments in code blocks, shown beside the original code (`bilingualMarkdown.translateCodeComments`, off by default). Only the comment text is sent.
- A cache of translations, a glossary, and style instructions for the translator.
- An interface in English and Japanese.
