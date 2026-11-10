import { createHash } from "node:crypto";
import type { ProviderResolution } from "../translate/service";
import { AnthropicProvider, listAnthropicModels } from "./anthropic";
import { OpenAIProvider, listCompatibleModels } from "./openai";
import type { KeyProviderId, ModelInfo, ProviderId, ReasoningEffortSetting, TranslationProvider } from "./types";

export interface ProviderSettings {
  provider: ProviderId;
  /** For `vscode`, a language model ID, or "" for the first Copilot model. */
  model: string;
  /** OpenAI only; "" for api.openai.com. The other services have fixed endpoints. */
  baseUrl: string;
  reasoningEffort: ReasoningEffortSetting;
}

/** `apiKey` is "" for the VS Code Language Model API, which needs none. */
export type CreateProvider = (settings: ProviderSettings, apiKey: string) => TranslationProvider;

/**
 * Sent as the API key to an OpenAI-compatible server on this machine when no key is stored.
 * Local servers such as Ollama and LM Studio do not check it, but the SDK needs one.
 */
export const LOCAL_SERVER_KEY = "local";

/** Builds the provider for the current settings and key, reusing the client while neither changes. */
export class ProviderFactory {
  private cached: { signature: string; provider: TranslationProvider } | undefined;

  constructor(
    private readonly getKey: (provider: KeyProviderId) => string | undefined,
    private readonly getSettings: () => ProviderSettings,
    private readonly create: CreateProvider = createProvider,
  ) {}

  resolve(): ProviderResolution {
    const settings = this.getSettings();
    if (settings.provider === "openai" && settings.baseUrl && !isAllowedBaseUrl(settings.baseUrl)) {
      return { ok: false, reason: "invalidBaseUrl" };
    }
    const apiKey = apiKeyFor(settings, this.getKey);
    if (apiKey === undefined) return { ok: false, reason: "missingKey" };
    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const signature = JSON.stringify([settings.provider, settings.model, settings.baseUrl, settings.reasoningEffort, keyHash]);
    if (this.cached?.signature !== signature) this.cached = { signature, provider: this.create(settings, apiKey) };
    return { ok: true, provider: this.cached.provider };
  }

  invalidate(): void {
    this.cached = undefined;
  }
}

/** Creates the providers that use an API key. The extension adds the VS Code Language Model API. */
export function createProvider(settings: ProviderSettings, apiKey: string): TranslationProvider {
  switch (settings.provider) {
    case "anthropic":
      return new AnthropicProvider(apiKey, settings.model, settings.reasoningEffort);
    case "vscode":
      throw new Error("The VS Code Language Model API is not available here.");
    default:
      return new OpenAIProvider(apiKey, settings.model, settings.reasoningEffort, settings.baseUrl || undefined, settings.provider);
  }
}

/**
 * The key to use: "" for VS Code, which needs none, and undefined when no key is stored.
 * Without a stored key, only an OpenAI-compatible server on this machine can be used.
 */
export function apiKeyFor(settings: ProviderSettings, getKey: (provider: KeyProviderId) => string | undefined): string | undefined {
  if (settings.provider === "vscode") return "";
  const stored = getKey(settings.provider);
  if (stored !== undefined) return stored;
  return settings.provider === "openai" && isLoopbackUrl(settings.baseUrl) ? LOCAL_SERVER_KEY : undefined;
}

/** The models a provider that uses an API key offers. The extension lists VS Code's own models. */
export async function listModels(settings: ProviderSettings, apiKey: string): Promise<ModelInfo[]> {
  switch (settings.provider) {
    case "anthropic":
      return listAnthropicModels(apiKey);
    case "vscode":
      throw new Error("The VS Code Language Model API is not available here.");
    default:
      return listCompatibleModels(settings.provider, apiKey, settings.baseUrl);
  }
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** A URL on this machine, such as a local Ollama or LM Studio server. */
export function isLoopbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** The key goes wherever this URL points, so only HTTPS (or plain HTTP to this machine) is allowed. */
export function isAllowedBaseUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  return url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname));
}
