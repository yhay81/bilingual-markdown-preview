import * as vscode from "vscode";
import { exportFileName, type ExportResult } from "../markdown/export";

/**
 * Writes the translated Markdown to `target`, or to a file the user picks, by default `README.ja.md`
 * beside `README.md`. A file the user picked is opened. Tests pass `target`.
 */
export async function saveTranslation(
  document: vscode.TextDocument,
  { markdown, untranslated }: ExportResult,
  targetLanguage: string,
  target?: vscode.Uri,
): Promise<vscode.Uri | undefined> {
  let uri = target;
  if (!uri) {
    const name = exportFileName(document.uri.path.split("/").pop() || "document.md", targetLanguage);
    const folder = document.uri.scheme === "untitled" ? vscode.workspace.workspaceFolders?.[0]?.uri : vscode.Uri.joinPath(document.uri, "..");
    uri = await vscode.window.showSaveDialog({
      defaultUri: folder ? vscode.Uri.joinPath(folder, name) : undefined,
      filters: { Markdown: ["md"] },
      saveLabel: vscode.l10n.t("Save Translation"),
    });
    if (!uri) return undefined;
  }
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(markdown));
  if (!target) {
    await vscode.window.showTextDocument(uri, { preview: false });
    if (untranslated > 0) {
      void vscode.window.showWarningMessage(vscode.l10n.t("{0} segments are not translated yet, so they were saved as written.", untranslated));
    }
  }
  return uri;
}
