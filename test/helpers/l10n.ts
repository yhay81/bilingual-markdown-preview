import type { L10n } from "../../src/preview/l10n";

/** Fills in `{0}`, `{1}`, ... like `vscode.l10n.t`, without translating. */
export const testL10n: L10n = { t: (message, ...args) => message.replace(/\{(\d+)\}/g, (_match, i: string) => String(args[Number(i)])) };
