# Contributing

Thank you for helping with Bilingual Markdown Preview. Report bugs and suggest features in [GitHub Issues](https://github.com/yhay81/bilingual-markdown-preview/issues). Before you start on a large change, open an issue so that we can agree on the approach.

## Set up

You need Node.js 22.12 or later and VS Code 1.101 or later.

```bash
git clone https://github.com/yhay81/bilingual-markdown-preview.git
cd bilingual-markdown-preview
npm install
```

## Build and test

- `npm run build` bundles the extension and the webview into `dist/`.
- `npm run watch` bundles them again on every change.
- `npm run check` runs the type checks and the tests. Run it before you open a pull request. CI runs it too.
- Press F5 in VS Code to build the extension and open it in an Extension Development Host.

The tests never call a translation API. To see real translations in the Extension Development Host, set your own key with **Bilingual Markdown: Set API Key**. Translation is billed to the account that issued the key.

## Where things are

- `src/extension.ts`: activation and the commands.
- `src/config.ts`, `src/settings.ts` and `src/secrets.ts`: the settings and the API keys.
- `src/markdown/`: splitting Markdown into rows, rendering them, and finding the comments in code blocks.
- `src/translate/`: prompts, placeholders, validation, the cache and the translation queue.
- `src/providers/`: the Anthropic and OpenAI clients.
- `src/preview/`: the preview panels and their HTML.
- `src/webview/`: the script that runs inside the preview.
- `src/shared/`: the messages between the extension and the preview.
- `l10n/` and `package.nls*.json`: the English and Japanese strings.
- `test/`: the tests, run with Vitest.

## Try the package

Build a VSIX and install it in VS Code. Run both commands in the repository folder, where `npm run package` writes the VSIX.

```bash
npm run package
```

```bash
code --install-extension bilingual-markdown-preview-0.1.0.vsix
```

## Release

1. Change `version` in `package.json`, and add the changes under that version in `CHANGELOG.md`.
2. Run `npm run check` and `npm run package`, and try the VSIX in VS Code.
3. Push the commit to `main`. The Marketplace page shows the images in `README.md` from GitHub, so the repository must be public and up to date.
4. Publish the VSIX you tried. The first time, vsce asks for a Personal Access Token for the `yhay81` publisher. [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) explains how to create one.

   ```bash
   npx vsce publish --packagePath bilingual-markdown-preview-0.1.0.vsix
   ```

5. Tag the commit with the version, such as `v0.1.0`, push the tag, and create a GitHub release with the VSIX attached.
