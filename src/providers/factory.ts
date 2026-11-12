import { createHash } from "node:crypto";
import type { ProviderResolution } from "../translate/service";
import { AnthropicProvider, listAnthropicModels } from "./anthropic";
import { PROVIDERS, isClaudeModel } from "./catalog";
import { OpenAIProvider, listCompatibleModels } from "./openai";
import { VertexProvider } from "./vertex";
import type { KeyProviderId, ModelInfo, ProviderId, ReasoningEffortSetting, TranslationProvider } from "./types";

export interface ProviderSettings {
  provider: ProviderId;
  /** For `vscode`, a language model ID, or "" for the first Copilot model. */
  model: string;
  /**
   * The endpoint from the settings: OpenAI's base URL ("" for api.openai.com), the Azure resource's
   * endpoint, or the Bedrock endpoint of the chosen region. "" for the services with a fixed one.
   */
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
    if (settings.provider === "azure" && !isHttpsUrl(settings.baseUrl)) return { ok: false, reason: "invalidEndpoint" };
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
    case "vertex":
      return new VertexProvider(apiKey, settings.model, settings.reasoningEffort);
    case "vscode":
      throw new Error("The VS Code Language Model API is not available here.");
    case "azure":
    case "bedrock":
      // Both serve Claude through the Anthropic Messages API and other models through Chat Completions.
      return isClaudeModel(settings.model)
        ? new AnthropicProvider(apiKey, settings.model, settings.reasoningEffort, settings.provider, `${settings.baseUrl}/anthropic`)
        : new OpenAIProvider(apiKey, settings.model, settings.reasoningEffort, `${settings.baseUrl}/openai/v1`, settings.provider);
    default:
      return new OpenAIProvider(apiKey, settings.model, settings.reasoningEffort, settings.baseUrl || undefined, settings.provider);
  }
}

/**
 * Resolves the configured key, with a placeholder for a local server and "" for VS Code.
 */
export function apiKeyFor(settings: ProviderSettings, getKey: (provider: KeyProviderId) => string | undefined): string | undefined {
  if (settings.provider === "vscode") return "";
  const stored = getKey(settings.provider);
  if (stored !== undefined) return stored;
  return settings.provider === "openai" && isLoopbackUrl(settings.baseUrl) ? LOCAL_SERVER_KEY : undefined;
}

/** The models a provider that uses an API key offers. The extension lists VS Code's own models. */
export async function listModels(settings: ProviderSettings, apiKey: string): Promise<ModelInfo[]> {
  const suggested = PROVIDERS[settings.provider].suggestedModels;
  if (suggested) return suggested.map((id) => ({ id }));
  switch (settings.provider) {
    case "anthropic":
      return listAnthropicModels(apiKey);
    case "vertex":
    case "vscode":
      throw new Error(`${settings.provider} models are not listed here.`);
    default:
      return listCompatibleModels(settings.provider, apiKey, settings.baseUrl);
  }
}

/** Whether Choose Model can offer a list for this provider without an API key. */
export function listsModelsWithoutKey(provider: ProviderId): boolean {
  return PROVIDERS[provider].suggestedModels !== undefined;
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

/** An HTTPS URL without credentials in it. */
export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
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
