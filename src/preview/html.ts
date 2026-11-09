import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import type { InitData } from "../shared/protocol";

/**
 * The webview page. Scripts run only with the nonce; document HTML is sanitized again in the
 * webview before it is inserted. `<base>` makes relative image paths resolve next to the document.
 */
export function buildWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri, documentUri: vscode.Uri, init: InitData): string {
  const nonce = randomBytes(18).toString("base64");
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "webview", "main.js"));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "preview.css"));
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

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
