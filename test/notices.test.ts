import { describe, expect, it } from "vitest";
import { noticeFor, type NoticeState } from "../src/preview/notices";
import { DEFAULT_CONFIG } from "../src/settings";
import { testL10n } from "./helpers/l10n";

const state = (overrides: Partial<NoticeState>): NoticeState => ({ config: DEFAULT_CONFIG, block: undefined, failed: 0, lastError: undefined, ...overrides });
const actionsOf = (overrides: Partial<NoticeState>) => noticeFor(state(overrides), testL10n)?.actions?.map((action) => action.action);

describe("noticeFor", () => {
  it("shows nothing while translation runs and nothing failed", () => {
    expect(noticeFor(state({}), testL10n)).toBeNull();
  });

  it("asks for a missing key with the provider's name", () => {
    expect(noticeFor(state({ block: { reason: "missingKey" } }), testL10n)).toMatchObject({
      severity: "info",
      blocking: true,
      message: "Set your Anthropic API key to start translating. It is kept in VS Code Secret Storage.",
    });
    expect(actionsOf({ block: { reason: "missingKey" } })).toEqual(["setApiKey", "switchProvider"]);
  });

  it("adds the provider's message to errors", () => {
    expect(noticeFor(state({ block: { reason: "auth", message: "invalid x-api-key" } }), testL10n)?.message).toBe(
      "Anthropic rejected the API key. (invalid x-api-key)",
    );
    expect(noticeFor(state({ block: { reason: "notFound" } }), testL10n)?.message).toBe(
      `Model ${DEFAULT_CONFIG.models.anthropic} was not found. Choose another model.`,
    );
  });

  it("explains the VS Code Language Model API's own errors", () => {
    const config = { ...DEFAULT_CONFIG, provider: "vscode" as const };
    expect(noticeFor(state({ config, block: { reason: "permission" } }), testL10n)?.message).toMatch(/^VS Code did not allow/);
    expect(actionsOf({ config, block: { reason: "auth" } })).toEqual(["chooseModel", "resume", "switchProvider"]);
    // Other reasons read the same as for any provider.
    expect(actionsOf({ config, block: { reason: "tokenLimit" } })).toEqual(["resume", "openSettings"]);
  });

  it("asks for the Azure endpoint and checks the OpenAI base URL", () => {
    expect(actionsOf({ block: { reason: "invalidEndpoint" } })).toEqual(["openSettings", "switchProvider"]);
    expect(actionsOf({ block: { reason: "invalidBaseUrl" } })).toEqual(["openSettings"]);
  });

  it("puts a block before failures", () => {
    expect(noticeFor(state({ block: { reason: "tokenLimit" }, failed: 3 }), testL10n)?.blocking).toBe(true);
  });

  it("counts failed segments and offers to retry them", () => {
    expect(noticeFor(state({ failed: 2, lastError: { kind: "overloaded", message: "Overloaded" } }), testL10n)).toEqual({
      severity: "warning",
      blocking: false,
      message: "2 segments could not be translated. (Overloaded)",
      actions: [{ label: "Retry", action: "retryFailed" }],
    });
  });
});
