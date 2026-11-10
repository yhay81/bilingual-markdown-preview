import * as vscode from "vscode";
import { ProviderError, type ProviderErrorKind, type TranslateRequest, type TranslateResult, type TranslationProvider } from "./types";

/** Vendor of the models that GitHub Copilot contributes. */
export const COPILOT_VENDOR = "copilot";

/**
 * Translation through the VS Code Language Model API, for example with GitHub Copilot. No API key:
 * VS Code asks the user once whether this extension may use the model, and usage counts against
 * their Copilot plan. The API has no system role, no output limit and no usage report.
 */
export class VsCodeLmProvider implements TranslationProvider {
  readonly id = "vscode";

  constructor(
    /** A model ID from `vscode.lm.selectChatModels`, or "" for the first Copilot model. */
    readonly model: string,
    private readonly justification: string,
  ) {}

  async translate(request: TranslateRequest): Promise<TranslateResult> {
    const source = new vscode.CancellationTokenSource();
    const cancel = (): void => source.cancel();
    request.signal.addEventListener("abort", cancel, { once: true });
    try {
      if (request.signal.aborted) throw new ProviderError("aborted", "The request was cancelled.");
      const chat = await selectModel(this.model);
      if (!chat) {
        throw new ProviderError(
          "notFound",
          this.model
            ? `No language model with the ID ${this.model} is available.`
            : "No language model is available. Install GitHub Copilot and sign in.",
        );
      }
      const messages = [vscode.LanguageModelChatMessage.User(request.system), vscode.LanguageModelChatMessage.User(request.user)];
      const response = await chat.sendRequest(messages, { justification: this.justification }, source.token);
      for await (const chunk of response.text) {
        if (request.signal.aborted) throw new ProviderError("aborted", "The request was cancelled.");
        request.onText(chunk);
      }
      return { stopReason: "end" };
    } catch (error) {
      throw toProviderError(error, request.signal.aborted);
    } finally {
      request.signal.removeEventListener("abort", cancel);
      source.dispose();
    }
  }
}

/** The model for an ID or family, or the first Copilot model when `model` is empty. */
export async function selectModel(model: string): Promise<vscode.LanguageModelChat | undefined> {
  if (!model) return (await vscode.lm.selectChatModels({ vendor: COPILOT_VENDOR }))[0];
  const [byId] = await vscode.lm.selectChatModels({ id: model });
  return byId ?? (await vscode.lm.selectChatModels({ family: model }))[0];
}

export function lmErrorKind(code: string): ProviderErrorKind {
  switch (code) {
    case "NoPermissions":
      return "permission";
    case "NotFound":
      return "notFound";
    case "Blocked":
      return "rateLimit";
    default:
      return "unknown";
  }
}

function toProviderError(error: unknown, aborted: boolean): ProviderError {
  if (error instanceof ProviderError) return error;
  if (aborted || error instanceof vscode.CancellationError) {
    return new ProviderError("aborted", "The request was cancelled.", { cause: error });
  }
  if (error instanceof vscode.LanguageModelError) {
    const cause = error.cause instanceof Error ? error.cause.message : undefined;
    return new ProviderError(lmErrorKind(error.code), cause ?? error.message, { cause: error });
  }
  return new ProviderError("unknown", error instanceof Error ? error.message : String(error), { cause: error });
}
