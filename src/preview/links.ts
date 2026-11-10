import * as vscode from "vscode";

/** Links never navigate the webview: web links open in the browser, relative paths in VS Code. */
export async function openLink(href: string, documentUri: vscode.Uri): Promise<void> {
  const link = href.trim();
  if (!link || link.startsWith("#") || link.startsWith("//")) return;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(link)?.[1]?.toLowerCase();
  if (scheme) {
    if (scheme === "http" || scheme === "https" || scheme === "mailto") {
      await vscode.env.openExternal(vscode.Uri.parse(link, true));
    }
    return;
  }
  const target = resolveRelative(link, documentUri);
  if (target) await vscode.commands.executeCommand("vscode.open", target);
}

/** A path relative to the document, or, starting with `/`, to its workspace folder. */
function resolveRelative(link: string, documentUri: vscode.Uri): vscode.Uri | undefined {
  const path = link.split(/[?#]/, 1)[0];
  if (!path) return undefined;
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // Keep the raw path.
  }
  if (decoded.startsWith("/")) {
    const folder = vscode.workspace.getWorkspaceFolder(documentUri);
    return folder ? vscode.Uri.joinPath(folder.uri, decoded) : undefined;
  }
  if (documentUri.scheme === "untitled") return undefined;
  return vscode.Uri.joinPath(documentUri, "..", decoded);
}
