import Anthropic from "@anthropic-ai/sdk";
import { anthropicReasoningParams } from "./params";
import {
  ProviderError,
  errorKindForStatus,
  type ReasoningEffortSetting,
  type StopReason,
  type TranslateRequest,
  type TranslateResult,
  type TranslationProvider,
} from "./types";

export const ANTHROPIC_API_URL = "https://api.anthropic.com";

export class AnthropicProvider implements TranslationProvider {
  readonly id = "anthropic";
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
    private readonly effort: ReasoningEffortSetting,
  ) {
    // An explicit endpoint, so ANTHROPIC_BASE_URL or an SDK profile cannot send the key elsewhere.
    // The SDK retries connection errors, 408, 409, 429 and 5xx with backoff.
    this.client = new Anthropic({ apiKey, baseURL: ANTHROPIC_API_URL, maxRetries: 3 });
  }

  async translate(request: TranslateRequest): Promise<TranslateResult> {
    try {
      const stream = this.client.messages.stream(
        {
          model: this.model,
          max_tokens: request.maxOutputTokens,
          system: request.system,
          messages: [{ role: "user", content: request.user }],
          ...anthropicReasoningParams(this.model, this.effort),
        },
        { signal: request.signal },
      );
      stream.on("text", (delta) => request.onText(delta));
      const message = await stream.finalMessage();
      const usage = { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens };
      return { stopReason: stopReasonOf(message.stop_reason), usage };
    } catch (error) {
      throw toProviderError(error);
    }
  }
}

function stopReasonOf(reason: string | null): StopReason {
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
      return "end";
    case "max_tokens":
    case "model_context_window_exceeded":
      return "max_tokens";
    case "refusal":
      return "refusal";
    default:
      return "other";
  }
}

function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof Anthropic.APIUserAbortError) return new ProviderError("aborted", "The request was cancelled.", { cause: error });
  if (error instanceof Anthropic.APIConnectionError) {
    return new ProviderError("network", `Could not reach the Anthropic API: ${error.message}`, { cause: error });
  }
  if (error instanceof Anthropic.APIError) {
    const status = error.status;
    return new ProviderError(errorKindForStatus(status), error.apiMessage ?? error.message, { status, cause: error });
  }
  if (error instanceof Error && error.name === "AbortError") return new ProviderError("aborted", error.message, { cause: error });
  return new ProviderError("unknown", error instanceof Error ? error.message : String(error), { cause: error });
}
