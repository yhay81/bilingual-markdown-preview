import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import type { InitData, UiStrings, ViewMode } from "../shared/protocol";

/**
 * The webview page. Scripts run only with the nonce; document HTML is sanitized again in the
 * webview before it is inserted. `<base>` makes relative image paths resolve next to the document.
 */
export function buildWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri, documentUri: vscode.Uri, mode: ViewMode): string {
  const init = initData(webview, extensionUri, documentUri, mode);
  const nonce = randomBytes(18).toString("base64");
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "webview", "main.js"));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "preview.css"));
  const katexUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "katex", "katex.min.css"));
  const base = documentUri.scheme === "untitled" ? "" : `<base href="${escapeAttribute(webview.asWebviewUri(documentUri).toString())}">`;
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} https: data:`,
    `media-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");
  const initJson = JSON.stringify(init).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="${escapeAttribute(init.lang)}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${base}
<link rel="stylesheet" href="${escapeAttribute(katexUri.toString())}">
<link rel="stylesheet" href="${escapeAttribute(styleUri.toString())}">
</head>
<body data-mode="${escapeAttribute(init.mode)}">
<header id="toolbar" class="toolbar"></header>
<div id="notice" class="notice" role="status" hidden></div>
<main id="rows" class="rows"></main>
<script type="application/json" id="bm-init">${initJson}</script>
<script nonce="${nonce}" src="${escapeAttribute(scriptUri.toString())}"></script>
</body>
</html>`;
}

/** Scripts may run; resources load from the extension, the workspace, and the document's folder. */
export function webviewOptions(extensionUri: vscode.Uri, documentUri: vscode.Uri): vscode.WebviewOptions {
  const roots = [vscode.Uri.joinPath(extensionUri, "dist"), vscode.Uri.joinPath(extensionUri, "media")];
  for (const folder of vscode.workspace.workspaceFolders ?? []) roots.push(folder.uri);
  if (documentUri.scheme !== "untitled" && !vscode.workspace.getWorkspaceFolder(documentUri)) {
    roots.push(vscode.Uri.joinPath(documentUri, ".."));
  }
  return { enableScripts: true, enableCommandUris: false, localResourceRoots: roots };
}

function initData(webview: vscode.Webview, extensionUri: vscode.Uri, documentUri: vscode.Uri, mode: ViewMode): InitData {
  const mermaid = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "webview", "mermaid.js"));
  return { documentUri: documentUri.toString(), lang: vscode.env.language, mode, strings: uiStrings(), mermaidScriptUri: mermaid.toString() };
}

function uiStrings(): UiStrings {
  return {
    modeSource: vscode.l10n.t("Source"),
    modeBoth: vscode.l10n.t("Side by side"),
    modeTranslation: vscode.l10n.t("Translation"),
    retranslate: vscode.l10n.t("Retranslate"),
    settings: vscode.l10n.t("Settings"),
    chooseModel: vscode.l10n.t("Choose Model"),
    chooseTargetLanguage: vscode.l10n.t("Choose Target Language"),
    retry: vscode.l10n.t("Retry"),
    exportTranslation: vscode.l10n.t("Save Translation as Markdown"),
    edit: vscode.l10n.t("Edit"),
    edited: vscode.l10n.t("Edited"),
    revert: vscode.l10n.t("Revert"),
    save: vscode.l10n.t("Save"),
    cancel: vscode.l10n.t("Cancel"),
    tokens: vscode.l10n.t("{0} tokens", "{0}"),
    // The webview fills in the placeholders.
    progress: vscode.l10n.t("{0}/{1} translated", "{0}", "{1}"),
    failed: vscode.l10n.t("{0} failed", "{0}"),
    warning: vscode.l10n.t("Check this translation"),
  };
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
