/** Providers reached through an OpenAI-compatible Chat Completions API with the user's own key. */
export const COMPATIBLE_PROVIDER_IDS = ["openai", "openrouter", "gemini", "deepseek", "mistral", "xai"] as const;

export type CompatibleProviderId = (typeof COMPATIBLE_PROVIDER_IDS)[number];

/** Providers that are used with the user's own API key. */
export const KEY_PROVIDER_IDS = ["anthropic", ...COMPATIBLE_PROVIDER_IDS] as const;

export type KeyProviderId = (typeof KEY_PROVIDER_IDS)[number];

/** `vscode` is the VS Code Language Model API (for example GitHub Copilot), which needs no API key. */
export const PROVIDER_IDS = [...KEY_PROVIDER_IDS, "vscode"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && (PROVIDER_IDS as readonly string[]).includes(value);
}

export function isKeyProviderId(value: unknown): value is KeyProviderId {
  return typeof value === "string" && (KEY_PROVIDER_IDS as readonly string[]).includes(value);
}

export function isCompatibleProviderId(value: unknown): value is CompatibleProviderId {
  return typeof value === "string" && (COMPATIBLE_PROVIDER_IDS as readonly string[]).includes(value);
}

/** `default` sends no reasoning parameter at all, for models or gateways that reject one. */
export type ReasoningEffortSetting = "none" | "low" | "medium" | "high" | "default";

export const REASONING_EFFORTS: readonly ReasoningEffortSetting[] = ["none", "low", "medium", "high", "default"];

export interface TranslateRequest {
  system: string;
  user: string;
  maxOutputTokens: number;
  signal: AbortSignal;
  /** Called with each chunk of streamed output text. */
  onText(delta: string): void;
}

export type StopReason = "end" | "max_tokens" | "refusal" | "other";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface TranslateResult {
  stopReason: StopReason;
  /** Tokens billed for the request, when the API reports them. */
  usage?: TokenUsage;
}

export interface TranslationProvider {
  readonly id: ProviderId;
  readonly model: string;
  translate(request: TranslateRequest): Promise<TranslateResult>;
}

/** A model a provider offers, for choosing one in the settings. */
export interface ModelInfo {
  id: string;
  /** A display name, when the API gives one. */
  name?: string;
}

export type ProviderErrorKind =
  | "auth"
  | "permission"
  | "notFound"
  | "badRequest"
  | "rateLimit"
  | "overloaded"
  | "network"
  | "aborted"
  | "unknown";

/** Provider failures in one shape, so the queue can decide whether to pause, fail, or stay quiet. */
export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly status: number | undefined;

  constructor(kind: ProviderErrorKind, message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "ProviderError";
    this.kind = kind;
    this.status = options.status;
  }
}

export function errorKindForStatus(status: number | undefined): ProviderErrorKind {
  switch (status) {
    case 400:
    case 413:
    case 422:
      return "badRequest";
    case 401:
      return "auth";
    case 403:
      return "permission";
    case 404:
      return "notFound";
    case 429:
      return "rateLimit";
    case 503:
    case 529:
      return "overloaded";
    default:
      return "unknown";
  }
}
