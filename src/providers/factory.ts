import { createHash } from "node:crypto";
import type { ProviderResolution } from "../translate/service";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import type { ProviderId, ReasoningEffortSetting, TranslationProvider } from "./types";

export interface ProviderSettings {
  provider: ProviderId;
  model: string;
  /** OpenAI only; "" for api.openai.com. */
  baseUrl: string;
  reasoningEffort: ReasoningEffortSetting;
}

export type CreateProvider = (settings: ProviderSettings, apiKey: string) => TranslationProvider;

/** Builds the provider for the current settings and key, reusing the client while neither changes. */
export class ProviderFactory {
  private cached: { signature: string; provider: TranslationProvider } | undefined;

  constructor(
    private readonly getKey: (provider: ProviderId) => string | undefined,
    private readonly getSettings: () => ProviderSettings,
    private readonly create: CreateProvider = createProvider,
  ) {}

  resolve(): ProviderResolution {
    const settings = this.getSettings();
    const apiKey = this.getKey(settings.provider);
    if (!apiKey) return { ok: false, reason: "missingKey" };
    if (settings.provider === "openai" && settings.baseUrl && !isAllowedBaseUrl(settings.baseUrl)) {
      return { ok: false, reason: "invalidBaseUrl" };
    }
    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const signature = JSON.stringify([settings.provider, settings.model, settings.baseUrl, settings.reasoningEffort, keyHash]);
    if (this.cached?.signature !== signature) this.cached = { signature, provider: this.create(settings, apiKey) };
    return { ok: true, provider: this.cached.provider };
  }

  invalidate(): void {
    this.cached = undefined;
  }
}

export function createProvider(settings: ProviderSettings, apiKey: string): TranslationProvider {
  return settings.provider === "anthropic"
    ? new AnthropicProvider(apiKey, settings.model, settings.reasoningEffort)
    : new OpenAIProvider(apiKey, settings.model, settings.reasoningEffort, settings.baseUrl || undefined);
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

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
