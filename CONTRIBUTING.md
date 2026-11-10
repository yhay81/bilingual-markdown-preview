# Contributing

Thank you for helping with Markdown Translation Preview. Report bugs and suggest features in [GitHub Issues](https://github.com/yhay81/markdown-translation-preview/issues). Before you start on a large change, open an issue so that we can agree on the approach.

## Set up

You need Node.js 22.12 or later and VS Code 1.101 or later.

```bash
git clone https://github.com/yhay81/markdown-translation-preview.git
cd markdown-translation-preview
npm install
```

## Build and test

- `npm run build` bundles the extension and the webview into `dist/`.
- `npm run watch` bundles them again on every change.
- `npm run check` runs the type checks and the tests. Run it before you open a pull request. CI runs it too.
- `npm run test:e2e` runs the end-to-end test in a real VS Code, which it downloads into `.vscode-test/` the first time. The test opens the preview for `test/e2e/workspace/guide.md`, translates it through a fake OpenAI-compatible server on 127.0.0.1, and saves the translation. CI runs it too, under `xvfb-run` on Linux.
- Press F5 in VS Code to build the extension and open it in an Extension Development Host.

The tests never call a translation API. To see real translations in the Extension Development Host, use GitHub Copilot (**Bilingual Markdown: Switch Translation Provider** → **VS Code Language Model**), a local server such as Ollama, or your own key for any provider with **Bilingual Markdown: Set API Key**. Translation with a key is billed to the account that issued it.

## Where things are

- `src/extension.ts`: activation and the commands.
- `src/config.ts`, `src/settings.ts` and `src/secrets.ts`: the settings and the API keys.
- `src/markdown/`: splitting Markdown into rows, rendering them, finding the comments in code blocks, and writing the translation out as Markdown.
- `src/translate/`: prompts, placeholders, validation, the cache and the translation queue.
- `src/providers/`: the Anthropic client, one client for OpenAI and the OpenAI-compatible services (`catalog.ts` lists their endpoints and reasoning parameters), and the VS Code Language Model API.
- `src/preview/`: the preview panels and their HTML.
- `src/webview/`: the script that runs inside the preview.
- `src/shared/`: the messages between the extension and the preview.
- `l10n/` and `package.nls*.json`: the strings in English, Japanese, Simplified Chinese and Korean. A new string needs an entry in every language.
- `test/`: the tests, run with Vitest. `test/e2e/`: the end-to-end test.

## Try the package

Build a VSIX and install it in VS Code. Run both commands in the repository folder, where `npm run package` writes the VSIX.

```bash
npm run package
```

```bash
code --install-extension markdown-translation-preview-0.1.0.vsix
```

## Release

Pushing a version tag runs the [Release workflow](.github/workflows/release.yml), which publishes the extension to the Visual Studio Marketplace, and to Open VSX once that is set up, and creates a GitHub release.

1. Change `version` in `package.json`, and add a section for that version to `CHANGELOG.md`, such as `## 0.2.0`.
2. Run `npm run check` and `npm run package`, and try the VSIX in VS Code.
3. Commit the changes and push them to `main`. The Marketplace page shows the images in `README.md` from GitHub, so push them before you release.
4. Tag the commit with `v` and the version, and push the tag:

   ```bash
   git tag -m v0.2.0 v0.2.0
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
| Repository | `markdown-translation-preview` |
| Workflow | `release.yml` |
| Environment | Leave it empty |

If the workflow file is renamed, the policy must be changed to match.

### Open VSX

[Open VSX](https://open-vsx.org) is the registry that VS Code forks such as VSCodium, Cursor and Windsurf install extensions from. The Release workflow publishes there too once these are set up:

1. Sign in to open-vsx.org with GitHub, sign the publisher agreement, and create an access token in the account settings.
2. Create the `yhay81` namespace, which must match `publisher` in `package.json`:

   ```bash
   npx ovsx create-namespace yhay81 -p <token>
   ```

3. In the repository settings on GitHub, under **Secrets and variables** → **Actions**, add the token as the secret `OVSX_PAT`, and add the variable `OPEN_VSX` with the value `true`.

Until `OPEN_VSX` is `true`, the workflow skips Open VSX.
