import type { CompatibleProviderId, ProviderId, ReasoningEffortSetting } from "./types";

export const REPOSITORY_URL = "https://github.com/yhay81/markdown-translation-preview";

export interface ProviderInfo {
  label: string;
  /** The model used until the user picks another. "" for VS Code: the first GitHub Copilot model. */
  defaultModel: string;
  /** Shown in the API key input box. */
  keyPlaceholder?: string;
}

export const PROVIDERS: Readonly<Record<ProviderId, ProviderInfo>> = {
  anthropic: { label: "Anthropic", defaultModel: "claude-haiku-5-5", keyPlaceholder: "sk-ant-..." },
  openai: { label: "OpenAI", defaultModel: "gpt-6-luna", keyPlaceholder: "sk-..." },
  openrouter: { label: "OpenRouter", defaultModel: "google/gemini-3.8-flash", keyPlaceholder: "sk-or-..." },
  gemini: { label: "Google Gemini", defaultModel: "gemini-3.8-flash", keyPlaceholder: "AIza..." },
  deepseek: { label: "DeepSeek", defaultModel: "deepseek-flash", keyPlaceholder: "sk-..." },
  mistral: { label: "Mistral AI", defaultModel: "mistral-small-2603" },
  xai: { label: "xAI", defaultModel: "grok-4.3", keyPlaceholder: "xai-..." },
  vscode: { label: "VS Code Language Model", defaultModel: "" },
};

export type ReasoningParams = Readonly<Record<string, unknown>>;

export interface CompatibleService {
  /** "" for OpenAI, whose endpoint is api.openai.com or the openai.baseUrl setting. */
  baseUrl: string;
  /** OpenAI's reasoning models reject `max_tokens`; the other services all accept it. */
  maxTokensParam: "max_completion_tokens" | "max_tokens";
  /** Whether to ask for token usage in the stream, an option that not every server accepts. */
  askForUsage: boolean;
  /** Whether models may reason even at `none`, so the output budget needs headroom. */
  reasonsAtNone: boolean;
  /**
   * Request parameters for a reasoning setting, most preferred first. Models of one service accept
   * different values, so when the API rejects one the next is tried, and finally none at all.
   */
  reasoning(effort: Exclude<ReasoningEffortSetting, "default">): ReasoningParams[];
  headers?: Readonly<Record<string, string>>;
}

const effortParam = (effort: string): ReasoningParams => ({ reasoning_effort: effort });

export const COMPATIBLE_SERVICES: Readonly<Record<CompatibleProviderId, CompatibleService>> = {
  openai: {
    baseUrl: "",
    maxTokensParam: "max_completion_tokens",
    askForUsage: true,
    reasonsAtNone: false,
    reasoning: (effort) => [effortParam(effort)],
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    maxTokensParam: "max_tokens",
    askForUsage: true,
    reasonsAtNone: false,
    // OpenRouter maps one effort onto each model's own controls; `none` turns reasoning off.
    reasoning: (effort) => [{ reasoning: { effort } }],
    // Identifies the app on OpenRouter's usage pages. Nothing about the user is sent.
    headers: { "HTTP-Referer": REPOSITORY_URL, "X-Title": "Markdown Translation Preview" },
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    maxTokensParam: "max_tokens",
    askForUsage: true,
    reasonsAtNone: true,
    // Only Gemini 2.5 Flash models can stop thinking; later models take their lowest level instead.
    reasoning: (effort) => (effort === "none" ? [effortParam("none"), effortParam("minimal"), effortParam("low")] : [effortParam(effort)]),
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    maxTokensParam: "max_tokens",
    askForUsage: true,
    reasonsAtNone: false,
    reasoning: (effort) => (effort === "none" ? [{ thinking: { type: "disabled" } }] : [effortParam(effort)]),
  },
  mistral: {
    baseUrl: "https://api.mistral.ai/v1",
    maxTokensParam: "max_tokens",
    askForUsage: false,
    reasonsAtNone: false,
    // Mistral Large takes no `none`; its lowest level is `low`.
    reasoning: (effort) => (effort === "none" ? [effortParam("none"), effortParam("low")] : [effortParam(effort)]),
  },
  xai: {
    baseUrl: "https://api.x.ai/v1",
    maxTokensParam: "max_tokens",
    askForUsage: true,
    reasonsAtNone: true,
    // Grok reasoning models cannot stop reasoning; `low` is the least they do.
    reasoning: (effort) => [effortParam(effort === "none" ? "low" : effort)],
  },
};

/** The reasoning parameters to try in order. The last one sends no parameter at all. */
export function reasoningAttempts(provider: CompatibleProviderId, effort: ReasoningEffortSetting): ReasoningParams[] {
  if (effort === "default") return [{}];
  return [...COMPATIBLE_SERVICES[provider].reasoning(effort), {}];
}
