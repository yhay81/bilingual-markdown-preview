# Contributing

Thank you for helping with Markdown Translation Preview. Report bugs and suggest features in [GitHub Issues](https://github.com/yhay81/bilingual-markdown-preview/issues). Before you start on a large change, open an issue so that we can agree on the approach.

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
code --install-extension markdown-translation-preview-0.1.0.vsix
```

## Release

Pushing a version tag runs the [Release workflow](.github/workflows/release.yml), which publishes the extension to the Visual Studio Marketplace and creates a GitHub release.

1. Change `version` in `package.json`, and add a section for that version to `CHANGELOG.md`, such as `## 0.2.0`.
2. Run `npm run check` and `npm run package`, and try the VSIX in VS Code.
3. Commit the changes and push them to `main`. The Marketplace page shows the images in `README.md` from GitHub, so push them before you release.
4. Tag the commit with `v` and the version, and push the tag:

   ```bash
   git tag v0.2.0
   ```

   ```bash
   git push origin v0.2.0
   ```

The workflow stops if the tag does not match the version in `package.json`, or if `CHANGELOG.md` has no section for the version. Otherwise it runs the checks, packages the extension, publishes the VSIX to the Marketplace, and creates a GitHub release with the VSIX and that section of the changelog. The run also keeps the VSIX as a build artifact.

### Trusted Publishing

The workflow signs in to the Marketplace with [Trusted Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension), so no token is stored anywhere. The owner of the `yhay81` publisher sets it up once: on the [publisher management page](https://marketplace.visualstudio.com/manage), open the publisher, select **Trusted Publishing**, and create a policy with these values.

| Field | Value |
| --- | --- |
| Policy name | Any name, such as `Release workflow` |
| Repository owner | `yhay81` |
| Repository | `bilingual-markdown-preview` |
| Workflow | `release.yml` |
| Environment | Leave it empty |

If the workflow file is renamed, the policy must be changed to match.
