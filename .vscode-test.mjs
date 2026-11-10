// End-to-end tests in a real VS Code, run by `npm run test:e2e` (see CONTRIBUTING.md).
import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "out/e2e/**/*.e2e.js",
  workspaceFolder: "test/e2e/workspace",
  launchArgs: ["--disable-extensions", "--disable-workspace-trust"],
  mocha: { ui: "bdd", timeout: 60_000 },
});
