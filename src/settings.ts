import { PROVIDERS } from "./providers/catalog";
import type { ProviderSettings } from "./providers/factory";
import { usesReasoning } from "./providers/params";
import { PROVIDER_IDS, REASONING_EFFORTS, isProviderId, type ProviderId, type ReasoningEffortSetting } from "./providers/types";
import { settingsFingerprint } from "./translate/keys";
import type { ServiceConfig } from "./translate/service";

/** Extension settings after validation. Pure, so it can be tested without VS Code. */
export interface ExtensionConfig {
  provider: ProviderId;
  targetLanguage: string;
  /** The model of each provider. For VS Code, a model ID, or "" for the first Copilot model. */
  models: Record<ProviderId, string>;
  openaiBaseUrl: string;
  reasoningEffort: ReasoningEffortSetting;
  styleInstructions: string;
  glossary: Record<string, string>;
  translateCodeComments: boolean;
  maxConcurrentRequests: number;
  batchCharacterLimit: number;
  /** Tokens (input and output) after which translation pauses in one session, or 0 for no limit. */
  tokenLimit: number;
  syncScroll: boolean;
}

export const DEFAULT_CONFIG: ExtensionConfig = {
  provider: "anthropic",
  targetLanguage: "Japanese",
  models: Object.fromEntries(PROVIDER_IDS.map((id) => [id, PROVIDERS[id].defaultModel])) as Record<ProviderId, string>,
  openaiBaseUrl: "",
  reasoningEffort: "none",
  styleInstructions: "",
  glossary: {},
  translateCodeComments: false,
  maxConcurrentRequests: 3,
  batchCharacterLimit: 4000,
  tokenLimit: 0,
  syncScroll: true,
};

export type RawConfig = Partial<Record<Exclude<keyof ExtensionConfig, "models">, unknown>> & {
  models?: Partial<Record<ProviderId, unknown>>;
};

export function sanitizeConfig(raw: RawConfig): ExtensionConfig {
  return {
    provider: isProviderId(raw.provider) ? raw.provider : DEFAULT_CONFIG.provider,
    targetLanguage: nonEmpty(raw.targetLanguage) ?? DEFAULT_CONFIG.targetLanguage,
    models: sanitizeModels(raw.models ?? {}),
    openaiBaseUrl: typeof raw.openaiBaseUrl === "string" ? raw.openaiBaseUrl.trim().replace(/\/+$/, "") : "",
    reasoningEffort: (REASONING_EFFORTS as readonly unknown[]).includes(raw.reasoningEffort)
      ? (raw.reasoningEffort as ReasoningEffortSetting)
      : DEFAULT_CONFIG.reasoningEffort,
    styleInstructions: typeof raw.styleInstructions === "string" ? raw.styleInstructions.trim().slice(0, 4000) : "",
    glossary: sanitizeGlossary(raw.glossary),
    translateCodeComments: raw.translateCodeComments === true,
    maxConcurrentRequests: clampInt(raw.maxConcurrentRequests, 1, 8, DEFAULT_CONFIG.maxConcurrentRequests),
    batchCharacterLimit: clampInt(raw.batchCharacterLimit, 500, 20_000, DEFAULT_CONFIG.batchCharacterLimit),
    tokenLimit: clampInt(raw.tokenLimit, 0, 1_000_000_000, DEFAULT_CONFIG.tokenLimit),
    syncScroll: typeof raw.syncScroll === "boolean" ? raw.syncScroll : DEFAULT_CONFIG.syncScroll,
  };
}

/** The configured model. For the VS Code Language Model API, "" means the first Copilot model. */
export function modelOf(config: ExtensionConfig): string {
  return config.models[config.provider];
}

/** The model as shown to the user. */
export function modelLabelOf(config: ExtensionConfig): string {
  return modelOf(config) || "Copilot";
}

export function providerSettingsOf(config: ExtensionConfig): ProviderSettings {
  return {
    provider: config.provider,
    model: modelOf(config),
    baseUrl: config.provider === "openai" ? config.openaiBaseUrl : "",
    reasoningEffort: config.reasoningEffort,
  };
}

export function serviceConfigOf(config: ExtensionConfig): ServiceConfig {
  return {
    prompt: {
      targetLanguage: config.targetLanguage,
      styleInstructions: config.styleInstructions,
      glossary: config.glossary,
    },
    maxConcurrentRequests: config.maxConcurrentRequests,
    batchCharacterLimit: config.batchCharacterLimit,
    usesReasoning: usesReasoning(config.provider, modelOf(config), config.reasoningEffort),
    tokenLimit: config.tokenLimit,
  };
}

/** Everything that changes a translation, hashed. Part of every cache key. */
export function fingerprintOf(config: ExtensionConfig): string {
  const provider = providerSettingsOf(config);
  return settingsFingerprint({
    provider: provider.provider,
    model: provider.model || "auto",
    endpoint: provider.baseUrl,
    targetLanguage: config.targetLanguage,
    styleInstructions: config.styleInstructions,
    glossary: config.glossary,
  });
}

/** True when requests in flight were made with settings that no longer apply. */
export function translationSettingsChanged(before: ExtensionConfig, after: ExtensionConfig): boolean {
  return fingerprintOf(before) !== fingerprintOf(after) || before.reasoningEffort !== after.reasoningEffort;
}

export function providerLabel(provider: ProviderId): string {
  return PROVIDERS[provider].label;
}

/**
 * The glossary used for translation: the workspace's glossary files first, then the settings, which win
 * for a term in both. Files are read only in a trusted workspace.
 */
export function mergeGlossaries(...glossaries: ReadonlyArray<Readonly<Record<string, string>>>): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const glossary of glossaries) Object.assign(merged, sanitizeGlossary(glossary));
  return merged;
}

/** Parses a glossary file: a JSON object of term → translation. Anything else is an empty glossary. */
export function parseGlossaryFile(text: string): Record<string, string> {
  try {
    return sanitizeGlossary(JSON.parse(text));
  } catch {
    return {};
  }
}

/** An empty model falls back to the default, except for VS Code, where "" means the first Copilot model. */
function sanitizeModels(raw: Partial<Record<ProviderId, unknown>>): Record<ProviderId, string> {
  const models = { ...DEFAULT_CONFIG.models };
  for (const id of PROVIDER_IDS) {
    const value = raw[id];
    if (id === "vscode") models[id] = typeof value === "string" ? value.trim() : "";
    else models[id] = nonEmpty(value) ?? models[id];
  }
  return models;
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function sanitizeGlossary(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const glossary: Record<string, string> = {};
  for (const [source, translation] of Object.entries(value)) {
    if (typeof translation === "string" && source.trim() && translation.trim()) glossary[source.trim()] = translation.trim();
  }
  return glossary;
}
