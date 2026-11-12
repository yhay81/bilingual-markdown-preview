import OpenAI from "openai";
import { COMPATIBLE_SERVICES, reasoningAttempts, type ReasoningParams } from "./catalog";
import {
  ProviderError,
  errorKindForStatus,
  type CompatibleProviderId,
  type ModelInfo,
  type ReasoningEffortSetting,
  type StopReason,
  type TokenUsage,
  type TranslateRequest,
  type TranslateResult,
  type TranslationProvider,
} from "./types";

export const OPENAI_API_URL = "https://api.openai.com/v1";

/** OpenAI and the services that offer an OpenAI-compatible Chat Completions API. */
export class OpenAIProvider implements TranslationProvider {
  readonly id: CompatibleProviderId;
  private readonly client: OpenAI;
  /** Usage in the stream is an OpenAI extension that not every compatible server accepts. */
  private readonly askForUsage: boolean;
  private readonly maxTokensParam: "max_completion_tokens" | "max_tokens";
  private readonly attempts: ReasoningParams[];
  /** The first reasoning parameters in `attempts` that the API has not rejected. */
  private attempt = 0;

  /** `baseURL` is used for OpenAI, Azure and Bedrock; the other services have fixed endpoints. */
  constructor(
    apiKey: string,
    readonly model: string,
    effort: ReasoningEffortSetting,
    baseURL: string | undefined,
    provider: CompatibleProviderId = "openai",
  ) {
    const service = COMPATIBLE_SERVICES[provider];
    const endpoint = endpointOf(provider, baseURL ?? "");
    this.id = provider;
    this.client = compatibleClient(provider, apiKey, endpoint);
    this.askForUsage = service.askForUsage && (provider !== "openai" || endpoint === OPENAI_API_URL);
    this.maxTokensParam = service.maxTokensParam;
    this.attempts = reasoningAttempts(provider, effort);
  }

  async translate(request: TranslateRequest): Promise<TranslateResult> {
    for (;;) {
      const attempt = this.attempt;
      try {
        return await this.stream(request, this.attempts[attempt] ?? {});
      } catch (error) {
        // Requests in flight together may all be rejected; the next parameters are tried once.
        if (attempt < this.attempts.length - 1 && rejectsReasoning(error)) {
          if (this.attempt === attempt) this.attempt = attempt + 1;
          continue;
        }
        throw toProviderError(error);
      }
    }
  }

  private async stream(request: TranslateRequest, reasoning: ReasoningParams): Promise<TranslateResult> {
    // Chat Completions rather than Responses: OpenAI-compatible services support it widely.
    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        stream: true,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
        [this.maxTokensParam]: Math.min(request.maxOutputTokens, COMPATIBLE_SERVICES[this.id].maxOutputTokens ?? Infinity),
        ...(this.askForUsage ? { stream_options: { include_usage: true } } : {}),
        ...reasoning,
      },
      { signal: request.signal },
    );
    let finishReason: string | null = null;
    let refused = false;
    let usage: TokenUsage | undefined;
    for await (const chunk of stream) {
      if (chunk.usage) usage = { inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens };
      const choice = chunk.choices[0];
      if (!choice) continue;
      if (choice.delta?.content) request.onText(choice.delta.content);
      if (choice.delta?.refusal) refused = true;
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
    return { stopReason: refused ? "refusal" : stopReasonOf(finishReason), usage };
  }
}

/** The API endpoint. `baseUrl` comes from the settings, for the services without a fixed endpoint. */
export function endpointOf(provider: CompatibleProviderId, baseUrl: string): string {
  return COMPATIBLE_SERVICES[provider].baseUrl || baseUrl || OPENAI_API_URL;
}

function compatibleClient(provider: CompatibleProviderId, apiKey: string, endpoint: string): OpenAI {
  // Explicit endpoint, organization and project, so OPENAI_BASE_URL, OPENAI_ORG_ID and
  // OPENAI_PROJECT_ID meant for other tools neither redirect the key nor scope it elsewhere.
  return new OpenAI({
    apiKey,
    baseURL: endpoint,
    organization: null,
    project: null,
    maxRetries: 3,
    defaultHeaders: COMPATIBLE_SERVICES[provider].headers,
  });
}

/** Models that do not chat, such as embedding, speech and image models. */
const NOT_CHAT_RE = /embed|whisper|tts|transcri|dall-e|image|imagen|veo|sora|moderation|realtime|audio|\baqa\b/i;

/** The chat models the service offers to this key, as the API lists them. */
export async function listCompatibleModels(provider: CompatibleProviderId, apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
  const client = compatibleClient(provider, apiKey, endpointOf(provider, baseUrl));
  const models: ModelInfo[] = [];
  try {
    for await (const model of client.models.list()) {
      // Gemini lists its models as `models/<id>`.
      const id = model.id.replace(/^models\//, "");
      if (NOT_CHAT_RE.test(id)) continue;
      // PLaMo Deep Research runs background jobs through the Responses API.
      if (provider === "plamo" && id.endsWith("-deep-research")) continue;
      // Vercel AI Gateway gives each model a type, and offers batch-priced copies.
      const type = (model as { type?: unknown }).type;
      if ((typeof type === "string" && type !== "language") || id.endsWith("-batch")) continue;
      // OpenRouter adds a display name.
      const name = (model as { name?: unknown }).name;
      models.push(typeof name === "string" && name && name !== id ? { id, name } : { id });
    }
  } catch (error) {
    throw toProviderError(error);
  }
  return models;
}

/** A 400 or 422 about the reasoning parameters, which this model does not take in that form. */
function rejectsReasoning(error: unknown): boolean {
  return error instanceof OpenAI.APIError && (error.status === 400 || error.status === 422) && /reason|think|effort/i.test(error.message);
}

function stopReasonOf(reason: string | null): StopReason {
  switch (reason) {
    case "stop":
      return "end";
    case "length":
      return "max_tokens";
    case "content_filter":
      return "refusal";
    default:
      return "other";
  }
}

function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof OpenAI.APIUserAbortError) return new ProviderError("aborted", "The request was cancelled.", { cause: error });
  if (error instanceof OpenAI.APIConnectionError) {
    return new ProviderError("network", `Could not reach the API: ${error.message}`, { cause: error });
  }
  if (error instanceof OpenAI.APIError) {
    const status = error.status;
    return new ProviderError(errorKindForStatus(status), error.message, { status, cause: error });
  }
  if (error instanceof Error && error.name === "AbortError") return new ProviderError("aborted", error.message, { cause: error });
  return new ProviderError("unknown", error instanceof Error ? error.message : String(error), { cause: error });
}
