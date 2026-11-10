import { modelLabelOf, providerLabel, type ExtensionConfig } from "../settings";
import type { Notice, NoticeAction } from "../shared/protocol";
import type { Block, JobError } from "../translate/service";
import type { L10n } from "./l10n";

export interface NoticeState {
  config: ExtensionConfig;
  /** Why translation is stopped, if it is. */
  block: Block | undefined;
  /** Segments of the document that could not be translated. */
  failed: number;
  lastError: JobError | undefined;
}

/** The notice above the preview: why translation stopped and what to do about it, or how many segments failed. */
export function noticeFor(state: NoticeState, l10n: L10n): Notice | null {
  return blockNotice(state.config, state.block, l10n) ?? failureNotice(state.failed, state.lastError, l10n);
}

function blockNotice(config: ExtensionConfig, block: Block | undefined, l10n: L10n): Notice | undefined {
  if (!block) return undefined;
  const provider = providerLabel(config.provider);
  const model = modelLabelOf(config);
  const setKey: NoticeAction = { label: l10n.t("Set API Key"), action: "setApiKey" };
  const switchProvider: NoticeAction = { label: l10n.t("Switch Provider"), action: "switchProvider" };
  const openSettings: NoticeAction = { label: l10n.t("Open Settings"), action: "openSettings" };
  const chooseModel: NoticeAction = { label: l10n.t("Choose Model"), action: "chooseModel" };
  const tryAgain: NoticeAction = { label: l10n.t("Try Again"), action: "resume" };
  const detail = block.message ? ` (${block.message})` : "";

  if (config.provider === "vscode") {
    switch (block.reason) {
      case "permission":
        return {
          severity: "error",
          blocking: true,
          message:
            l10n.t(
              "VS Code did not allow this extension to use the language model. Allow it in the Accounts menu under Manage Language Model Access, then try again.",
            ) + detail,
          actions: [tryAgain, switchProvider],
        };
      case "notFound":
      case "auth":
        return {
          severity: "error",
          blocking: true,
          message: l10n.t("No language model is available in VS Code. Install GitHub Copilot and sign in, or choose another model.") + detail,
          actions: [chooseModel, tryAgain, switchProvider],
        };
      default:
        break;
    }
  }

  switch (block.reason) {
    case "tokenLimit":
      return {
        severity: "info",
        blocking: true,
        message: l10n.t("Translation paused: this session reached the token limit of {0}.", config.tokenLimit.toLocaleString()),
        actions: [{ label: l10n.t("Continue"), action: "resume" }, openSettings],
      };
    case "missingKey":
      return {
        severity: "info",
        blocking: true,
        message: l10n.t("Set your {0} API key to start translating. It is kept in VS Code Secret Storage.", provider),
        actions: [setKey, switchProvider],
      };
    case "invalidBaseUrl":
      return {
        severity: "error",
        blocking: true,
        message: l10n.t("The OpenAI base URL must start with https:// (or http://localhost)."),
        actions: [openSettings],
      };
    case "invalidEndpoint":
      return {
        severity: "info",
        blocking: true,
        message: l10n.t("Set the endpoint of your Azure resource, such as https://my-resource.services.ai.azure.com, to translate with Azure."),
        actions: [openSettings, switchProvider],
      };
    case "auth":
      return {
        severity: "error",
        blocking: true,
        message: l10n.t("{0} rejected the API key.", provider) + detail,
        actions: [setKey, switchProvider],
      };
    case "permission":
      return {
        severity: "error",
        blocking: true,
        message: l10n.t("This API key is not allowed to use {0}.", model) + detail,
        actions: [chooseModel, setKey],
      };
    case "notFound":
      return {
        severity: "error",
        blocking: true,
        message: l10n.t("Model {0} was not found. Choose another model.", model) + detail,
        actions: [chooseModel, switchProvider],
      };
  }
}

function failureNotice(failed: number, lastError: JobError | undefined, l10n: L10n): Notice | null {
  if (failed === 0) return null;
  return {
    severity: "warning",
    blocking: false,
    message: l10n.t("{0} segments could not be translated.", failed) + (lastError ? ` (${lastError.message})` : ""),
    actions: [{ label: l10n.t("Retry"), action: "retryFailed" }],
  };
}
