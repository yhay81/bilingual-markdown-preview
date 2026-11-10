/**
 * The part of `vscode.l10n` that the preview's logic uses, passed in so the logic runs in tests
 * without VS Code. Name it `l10n` and pass `t` the string written out, so that the localization
 * test finds the string.
 */
export interface L10n {
  t(message: string, ...args: Array<string | number | boolean>): string;
}
