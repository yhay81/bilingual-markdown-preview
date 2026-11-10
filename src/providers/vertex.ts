import {
  ProviderError,
  errorKindForStatus,
  type ReasoningEffortSetting,
  type StopReason,
  type TokenUsage,
  type TranslateRequest,
  type TranslateResult,
  type TranslationProvider,
} from "./types";

/**
 * Vertex AI's global endpoint. With an API key, only Google's own models can be used, through
 * `generateContent`; the OpenAI-compatible endpoint and partner models such as Claude need OAuth.
 */
export const VERTEX_API_URL = "https://aiplatform.googleapis.com/v1";

type ThinkingConfig = { thinkingLevel: "MINIMAL" | "LOW" | "MEDIUM" | "HIGH" };

/**
 * Thinking settings to try in order; the last sends none. Gemini 4 models take no `MINIMAL`, and
 * older models no `thinkingLevel` at all, so a rejected setting gives way to the next.
 */
export function vertexThinkingAttempts(effort: ReasoningEffortSetting): Array<ThinkingConfig | undefined> {
  switch (effort) {
    case "default":
      return [undefined];
    case "none":
      return [{ thinkingLevel: "MINIMAL" }, { thinkingLevel: "LOW" }, undefined];
    default:
      return [{ thinkingLevel: effort === "low" ? "LOW" : effort === "medium" ? "MEDIUM" : "HIGH" }, undefined];
  }
}

const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;

interface GenerateContentChunk {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
}

/** Gemini on Vertex AI, with an API key. */
export class VertexProvider implements TranslationProvider {
  readonly id = "vertex";
  private readonly attempts: Array<ThinkingConfig | undefined>;
  /** The first thinking setting in `attempts` that the API has not rejected. */
  private attempt = 0;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    effort: ReasoningEffortSetting,
    /** The first wait before retrying a request, doubled for each retry. */
    private readonly retryDelayMs = 1000,
  ) {
    this.attempts = vertexThinkingAttempts(effort);
  }

  async translate(request: TranslateRequest): Promise<TranslateResult> {
    for (;;) {
      const attempt = this.attempt;
      try {
        return await this.withRetries(request, () => this.stream(request, this.attempts[attempt]));
      } catch (error) {
        const rejected = error instanceof ProviderError && error.status === 400 && /think/i.test(error.message);
        if (attempt < this.attempts.length - 1 && rejected) {
          if (this.attempt === attempt) this.attempt = attempt + 1;
          continue;
        }
        throw toProviderError(error);
      }
    }
  }

  private async withRetries(request: TranslateRequest, send: () => Promise<TranslateResult>): Promise<TranslateResult> {
    for (let retry = 0; ; retry++) {
      try {
        return await send();
      } catch (error) {
        const retryable = error instanceof ProviderError && (error.kind === "network" || RETRY_STATUSES.has(error.status ?? 0));
        if (!retryable || retry >= MAX_RETRIES || request.signal.aborted) throw error;
        await delay(this.retryDelayMs * 2 ** retry, request.signal);
      }
    }
  }

  private async stream(request: TranslateRequest, thinking: ThinkingConfig | undefined): Promise<TranslateResult> {
    let response: Response;
    try {
      response = await fetch(`${VERTEX_API_URL}/publishers/google/models/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: request.user }] }],
          systemInstruction: { parts: [{ text: request.system }] },
          generationConfig: { maxOutputTokens: request.maxOutputTokens, ...(thinking ? { thinkingConfig: thinking } : {}) },
        }),
        signal: request.signal,
      });
    } catch (error) {
      throw toProviderError(error);
    }
    if (!response.ok) throw await httpError(response);
    if (!response.body) throw new ProviderError("unknown", "The API sent no response.");

    let finishReason: string | undefined;
    let blocked = false;
    let usage: TokenUsage | undefined;
    const handle = (chunk: GenerateContentChunk): void => {
      if (chunk.promptFeedback?.blockReason) blocked = true;
      const candidate = chunk.candidates?.[0];
      for (const part of candidate?.content?.parts ?? []) if (part.text && !part.thought) request.onText(part.text);
      if (candidate?.finishReason) finishReason = candidate.finishReason;
      const meta = chunk.usageMetadata;
      if (meta?.promptTokenCount !== undefined) {
        usage = { inputTokens: meta.promptTokenCount, outputTokens: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0) };
      }
    };
    try {
      for await (const data of sseData(response.body)) handle(JSON.parse(data) as GenerateContentChunk);
    } catch (error) {
      throw toProviderError(error);
    }
    return { stopReason: blocked ? "refusal" : stopReasonOf(finishReason), usage };
  }
}

/** The `data:` payloads of a server-sent event stream. */
async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = done ? "" : (lines.pop() ?? "");
      for (const line of lines) {
        if (line === "") {
          if (data.length > 0) yield data.join("\n");
          data = [];
        } else if (line.startsWith("data:")) {
          data.push(line.slice(5).replace(/^ /, ""));
        }
      }
      if (done) {
        if (data.length > 0) yield data.join("\n");
        return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function httpError(response: Response): Promise<ProviderError> {
  let message = `${response.status} ${response.statusText}`.trim();
  try {
    const body = (await response.json()) as { error?: { message?: unknown } } | Array<{ error?: { message?: unknown } }>;
    const detail = (Array.isArray(body) ? body[0] : body)?.error?.message;
    if (typeof detail === "string" && detail) message = detail;
  } catch {
    // Not JSON: keep the status line.
  }
  return new ProviderError(errorKindForStatus(response.status), message, { status: response.status });
}

function stopReasonOf(reason: string | undefined): StopReason {
  switch (reason) {
    case "STOP":
      return "end";
    case "MAX_TOKENS":
      return "max_tokens";
    case "SAFETY":
    case "RECITATION":
    case "BLOCKLIST":
    case "PROHIBITED_CONTENT":
    case "SPII":
      return "refusal";
    default:
      return "other";
  }
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, ms);
    function done(): void {
      signal.removeEventListener("abort", done);
      clearTimeout(timer);
      if (signal.aborted) reject(new ProviderError("aborted", "The request was cancelled."));
      else resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}

function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (error instanceof Error && error.name === "AbortError") return new ProviderError("aborted", "The request was cancelled.", { cause: error });
  if (error instanceof SyntaxError) return new ProviderError("unknown", `The API sent an unreadable response: ${error.message}`, { cause: error });
  if (error instanceof TypeError) return new ProviderError("network", `Could not reach the API: ${error.message}`, { cause: error });
  return new ProviderError("unknown", error instanceof Error ? error.message : String(error), { cause: error });
}
