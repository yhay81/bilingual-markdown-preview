# Changelog

## Unreleased

- Settings, commands and the command category are named after the extension: `markdownTranslation.*` and **Markdown Translation: …**, no longer `bilingualMarkdown.*` and **Bilingual Markdown: …**. Your settings, stored API keys and view mode are moved to the new names when the extension starts. Keybindings to the old command IDs need updating.
- Translate with your own key for OpenRouter, Vercel AI Gateway, Google Gemini, DeepSeek, Mistral AI or xAI, as well as Anthropic and OpenAI. Each provider keeps its own key and model.
- Translate with a model in Microsoft Azure (`markdownTranslation.azure.endpoint` and a deployment name), Amazon Bedrock (`markdownTranslation.bedrock.region`) or Google Cloud Vertex AI, with an API key. On Azure and Bedrock, Claude models go through their Anthropic API and other models through their OpenAI API.
- **Markdown Translation: Choose Target Language** picks the language to translate into from common languages, or takes any language you type. Clicking the language in the toolbar opens it too.
- **Markdown Translation: Choose Model** lists the models the current provider offers, or takes a model ID. Clicking the model name in the toolbar opens it too.
- When a model rejects a reasoning setting, the next lower one is tried, and finally none at all.
- Translate with GitHub Copilot or another language model in VS Code, with no API key (`markdownTranslation.provider`: `vscode`).
- Translate with a local model: a server on this machine, such as Ollama or LM Studio, needs no API key.
- Save the translation as a Markdown file, such as `README.ja.md`, from the toolbar or with **Markdown Translation: Save Translation as Markdown**.
- Correct a translation by hand in the preview. Edits are kept and can be reverted.
- A glossary file shared by the workspace: `.vscode/translation-glossary.json`.
- A document can choose its target language with `translate-to` in its front matter.
- The toolbar shows the tokens used, and `markdownTranslation.tokenLimit` pauses translation after that many.
- Each request carries the text just before it, for consistent terms and tone.
- Math is rendered with KaTeX and Mermaid diagrams are drawn. `<details>` blocks fold on both sides, and their summaries are translated.
- Text already in the target language is now recognized for Chinese, Korean, Russian, Ukrainian, Greek, Arabic, Hebrew, Thai, Hindi, Vietnamese, English, Spanish, French, German, Portuguese, Italian, Dutch, Polish, Turkish and Indonesian too, not only Japanese.
- An interface in Simplified Chinese, Traditional Chinese, Korean, Spanish, French, German, Brazilian Portuguese, Russian and Italian.
- Translations made by earlier versions are translated again once, because the prompt changed.

## 0.1.0

The first release.

- A preview that shows Markdown and its translation side by side, block by block. The toolbar switches between the source, both, and the translation alone. The editor and the preview scroll together, and in a narrow panel the translation goes under the source.
- Translation with your own API key: Anthropic (`claude-haiku-5-5`) or OpenAI (`gpt-6-luna`, or any OpenAI-compatible base URL). Keys are kept in VS Code Secret Storage.
- Streaming translation that starts with what is on screen, automatic retranslation when a translation drops a placeholder, and a Retry button on each row.
- Translation of the comments in code blocks, shown beside the original code (`bilingualMarkdown.translateCodeComments`, off by default). Only the comment text is sent.
- A cache of translations, a glossary, and style instructions for the translator.
- An interface in English and Japanese.
