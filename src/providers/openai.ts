import OpenAI from "openai";
import { openaiReasoningParams } from "./params";
import {
  ProviderError,
  errorKindForStatus,
  type ReasoningEffortSetting,
  type StopReason,
  type TranslateRequest,
  type TranslateResult,
  type TranslationProvider,
} from "./types";

export const OPENAI_API_URL = "https://api.openai.com/v1";

export class OpenAIProvider implements TranslationProvider {
  readonly id = "openai";
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    readonly model: string,
    private readonly effort: ReasoningEffortSetting,
    baseURL: string | undefined,
  ) {
    // Explicit endpoint, organization and project, so OPENAI_BASE_URL, OPENAI_ORG_ID and
    // OPENAI_PROJECT_ID meant for other tools neither redirect the key nor scope it elsewhere.
    this.client = new OpenAI({ apiKey, baseURL: baseURL || OPENAI_API_URL, organization: null, project: null, maxRetries: 3 });
  }

  async translate(request: TranslateRequest): Promise<TranslateResult> {
    try {
      // Chat Completions rather than Responses: OpenAI-compatible gateways support it widely.
      const stream = await this.client.chat.completions.create(
        {
          model: this.model,
          stream: true,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          max_completion_tokens: request.maxOutputTokens,
          ...openaiReasoningParams(this.effort),
        },
        { signal: request.signal },
      );
      let finishReason: string | null = null;
      let refused = false;
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;
        if (choice.delta?.content) request.onText(choice.delta.content);
        if (choice.delta?.refusal) refused = true;
        if (choice.finish_reason) finishReason = choice.finish_reason;
      }
      return { stopReason: refused ? "refusal" : stopReasonOf(finishReason) };
    } catch (error) {
      throw toProviderError(error);
    }
  }
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
