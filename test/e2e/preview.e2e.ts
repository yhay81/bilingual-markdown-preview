import * as assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import * as vscode from "vscode";
import { CONFIG_SECTION, migrateLegacySettings } from "../../src/config";
import { LEGACY_PREFIX } from "../../src/migration";

/**
 * End-to-end test in a real VS Code: opens the preview for a document, lets it translate through a
 * local OpenAI-compatible server, and exports the translation. Run with `npm run test:e2e`.
 */

declare function describe(title: string, body: () => void): void;
declare function it(title: string, body: () => Promise<void>): void;
declare function before(body: () => Promise<void>): void;
declare function after(body: () => Promise<void>): void;

const SEG_RE = /<seg id="(\d+)"(?: kind="[^"]*")?>([\s\S]*?)<\/seg>/g;

/** A fake model: each segment comes back prefixed with 訳, placeholders untouched. */
function startServer(requests: string[]): Promise<Server> {
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString("utf8")));
    request.on("end", () => {
      if (request.method !== "POST" || !request.url?.endsWith("/chat/completions")) {
        response.writeHead(404).end();
        return;
      }
      const { messages } = JSON.parse(body) as { messages: Array<{ role: string; content: string }> };
      const user = messages.find((message) => message.role === "user")?.content ?? "";
      requests.push(user);
      const output = [...user.matchAll(SEG_RE)].map(([, id, text]) => `<seg id="${id}">訳:${text}</seg>`).join("\n");
      const chunk = (delta: object, finish: string | null) =>
        `data: ${JSON.stringify({ id: "e2e", object: "chat.completion.chunk", created: 0, model: "e2e", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.write(chunk({ role: "assistant", content: output }, null));
      response.write(chunk({}, "stop"));
      response.end("data: [DONE]\n\n");
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function waitFor<T>(what: string, check: () => Promise<T | undefined>, timeout = 30_000): Promise<T> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await check();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}.`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

describe("Markdown Translation Preview", () => {
  const requests: string[] = [];
  let server: Server;
  const config = () => vscode.workspace.getConfiguration("markdownTranslation");

  before(async () => {
    server = await startServer(requests);
    const { port } = server.address() as AddressInfo;
    await config().update("provider", "openai", vscode.ConfigurationTarget.Global);
    await config().update("openai.model", "e2e-model", vscode.ConfigurationTarget.Global);
    await config().update("openai.baseUrl", `http://127.0.0.1:${port}/v1`, vscode.ConfigurationTarget.Global);
    await config().update("targetLanguage", "Japanese", vscode.ConfigurationTarget.Global);
  });

  after(async () => {
    server.close();
    for (const key of ["provider", "openai.model", "openai.baseUrl", "targetLanguage"]) {
      await config().update(key, undefined, vscode.ConfigurationTarget.Global);
    }
  });

  it("translates a document through a local server and exports it", async () => {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
    assert.ok(folder, "the test opens a workspace folder");
    const document = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder, "guide.md"));
    await vscode.window.showTextDocument(document);
    await vscode.commands.executeCommand("markdownTranslation.openPreviewToSide");

    const target = vscode.Uri.joinPath(folder, "out", "guide.ja.md");
    const exported = await waitFor("the translation", async () => {
      await vscode.commands.executeCommand("markdownTranslation.exportTranslation", target);
      const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(target));
      return text.includes("訳:Second item") ? text : undefined;
    });

    assert.ok(requests.length > 0, "the preview sent the document to the server");
    assert.ok(requests.some((user) => user.includes("Getting Started")));
    assert.equal(
      exported,
      [
        "# 訳:Getting Started",
        "",
        "訳:Install the package with `npm install example` and read [the guide](./guide.md).",
        "",
        "- 訳:First item",
        "- 訳:Second item",
        "",
        "```js",
        "const answer = 42;",
        "```",
        "",
      ].join("\n"),
    );
  });

  it("moves the settings of version 0.1 to their new names", async () => {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
    assert.ok(folder, "the test opens a workspace folder");
    const settingsDir = vscode.Uri.joinPath(folder, ".vscode");
    const settingsFile = vscode.Uri.joinPath(settingsDir, "settings.json");
    const legacy = { [`${LEGACY_PREFIX}.styleInstructions`]: "Be brief.", [`${LEGACY_PREFIX}.syncScroll`]: false };
    await vscode.workspace.fs.writeFile(settingsFile, new TextEncoder().encode(JSON.stringify(legacy, null, 2)));
    try {
      await waitFor("the workspace settings", async () =>
        vscode.workspace.getConfiguration().inspect(`${LEGACY_PREFIX}.syncScroll`)?.workspaceValue === false ? true : undefined,
      );
      await migrateLegacySettings(["styleInstructions", "syncScroll", "provider"]);

      const current = vscode.workspace.getConfiguration(CONFIG_SECTION);
      assert.equal(current.inspect("styleInstructions")?.workspaceValue, "Be brief.");
      assert.equal(current.inspect("syncScroll")?.workspaceValue, false);
      assert.equal(current.inspect("provider")?.workspaceValue, undefined);
      const written = JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(settingsFile))) as Record<string, unknown>;
      assert.deepEqual(written, { [`${CONFIG_SECTION}.styleInstructions`]: "Be brief.", [`${CONFIG_SECTION}.syncScroll`]: false });
    } finally {
      await vscode.workspace.fs.delete(settingsDir, { recursive: true });
    }
  });
});
