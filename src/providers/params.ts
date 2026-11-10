import { COMPATIBLE_SERVICES } from "./catalog";
import type { ProviderId, ReasoningEffortSetting } from "./types";

/** Claude models that reject `thinking: { type: "disabled" }`. */
const ALWAYS_THINKING_RE = /^claude-(?:opus|sonnet)-5|^claude-(?:fable|mythos)/;

export interface AnthropicReasoningParams {
  thinking?: { type: "disabled" } | { type: "adaptive" };
  output_config?: { effort: "low" | "medium" | "high" };
}

export function canDisableThinking(model: string): boolean {
  return !ALWAYS_THINKING_RE.test(model);
}

/**
 * Claude Haiku 5.5 thinks adaptively unless told otherwise. Translation rarely benefits, so `none`
 * turns thinking off; models that cannot turn it off get the lowest effort instead.
 * Temperature and other sampling parameters are never sent: current Claude models reject them.
 */
export function anthropicReasoningParams(model: string, effort: ReasoningEffortSetting): AnthropicReasoningParams {
  switch (effort) {
    case "default":
      return {};
    case "none":
      return canDisableThinking(model) ? { thinking: { type: "disabled" } } : { output_config: { effort: "low" } };
    default:
      return { thinking: { type: "adaptive" }, output_config: { effort } };
  }
}

/** Whether the model may spend output tokens on reasoning, so the output budget needs headroom. */
export function usesReasoning(provider: ProviderId, model: string, effort: ReasoningEffortSetting): boolean {
  // The VS Code Language Model API takes no output limit or reasoning setting.
  if (provider === "vscode") return false;
  if (effort !== "none") return true;
  return provider === "anthropic" ? !canDisableThinking(model) : COMPATIBLE_SERVICES[provider].reasonsAtNone;
}
