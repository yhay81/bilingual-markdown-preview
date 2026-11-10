import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicProvider } from "../src/providers/anthropic";
import {
  LOCAL_SERVER_KEY,
  ProviderFactory,
  apiKeyFor,
  createProvider,
  isAllowedBaseUrl,
  isLoopbackUrl,
  listModels,
  type ProviderSettings,
} from "../src/providers/factory";
import { OpenAIProvider } from "../src/providers/openai";
import { VertexProvider, vertexThinkingAttempts } from "../src/providers/vertex";
import { reasoningAttempts } from "../src/providers/catalog";
import { anthropicReasoningParams, canDisableThinking, usesReasoning } from "../src/providers/params";
import { ProviderError, errorKindForStatus, type KeyProviderId, type TranslateRequest } from "../src/providers/types";

// Dummy keys: requests go to a stubbed fetch, never to the network.
const ANTHROPIC_TEST_KEY = "sk-ant-test-dummy";
const OPENAI_TEST_KEY = "sk-test-dummy";

describe("reasoning parameters", () => {
  it("turn Claude thinking off where the model allows it", () => {
    expect(["claude-haiku-5-5", "claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-1"].map((model) => canDisableThinking(model))).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(anthropicReasoningParams("claude-haiku-5-5", "none")).toEqual({ thinking: { type: "disabled" } });
    expect(anthropicReasoningParams("claude-opus-5-5", "none")).toEqual({ output_config: { effort: "low" } });
    expect(anthropicReasoningParams("claude-haiku-5-5", "medium")).toEqual({ thinking: { type: "adaptive" }, output_config: { effort: "medium" } });
    expect(anthropicReasoningParams("claude-haiku-5-5", "default")).toEqual({});
  });

  it("pass the effort through to OpenAI, then nothing if the model rejects it", () => {
    expect(reasoningAttempts("openai", "none")).toEqual([{ reasoning_effort: "none" }, {}]);
    expect(reasoningAttempts("openai", "high")).toEqual([{ reasoning_effort: "high" }, {}]);
    expect(reasoningAttempts("openai", "default")).toEqual([{}]);
  });

  it("speak each service's own reasoning controls", () => {
    expect(reasoningAttempts("openrouter", "none")).toEqual([{ reasoning: { effort: "none" } }, {}]);
    expect(reasoningAttempts("gemini", "none")).toEqual([{ reasoning_effort: "none" }, { reasoning_effort: "minimal" }, { reasoning_effort: "low" }, {}]);
    expect(reasoningAttempts("gemini", "medium")).toEqual([{ reasoning_effort: "medium" }, {}]);
    expect(reasoningAttempts("deepseek", "none")).toEqual([{ thinking: { type: "disabled" } }, {}]);
    expect(reasoningAttempts("deepseek", "low")).toEqual([{ reasoning_effort: "low" }, {}]);
    expect(reasoningAttempts("mistral", "none")).toEqual([{ reasoning_effort: "none" }, { reasoning_effort: "low" }, {}]);
    expect(reasoningAttempts("xai", "none")).toEqual([{ reasoning_effort: "low" }, {}]);
    expect(reasoningAttempts("vercel", "low")).toEqual([{ reasoning: { effort: "low" } }, {}]);
    expect(reasoningAttempts("azure", "none")).toEqual([{ reasoning_effort: "none" }, { reasoning_effort: "minimal" }, { reasoning_effort: "low" }, {}]);
    expect(reasoningAttempts("bedrock", "none")).toEqual([{ reasoning_effort: "none" }, { reasoning_effort: "low" }, {}]);
    expect(vertexThinkingAttempts("none")).toEqual([{ thinkingLevel: "MINIMAL" }, { thinkingLevel: "LOW" }, undefined]);
    expect(vertexThinkingAttempts("medium")).toEqual([{ thinkingLevel: "MEDIUM" }, undefined]);
    expect(vertexThinkingAttempts("default")).toEqual([undefined]);
  });

  it("recognize Claude models by their Bedrock IDs too", () => {
    expect(canDisableThinking("global.anthropic.claude-haiku-5-5")).toBe(true);
    expect(canDisableThinking("us.anthropic.claude-sonnet-5-5")).toBe(false);
    expect(usesReasoning("bedrock", "global.anthropic.claude-haiku-5-5", "none")).toBe(false);
    expect(usesReasoning("azure", "claude-opus-5-5", "none")).toBe(true);
    expect(usesReasoning("bedrock", "openai.gpt-oss-120b-1:0", "none")).toBe(true);
    expect(usesReasoning("azure", "gpt-6-luna", "none")).toBe(false);
    expect(usesReasoning("vertex", "gemini-3.8-flash", "none")).toBe(true);
  });

  it("tell when output tokens go to reasoning", () => {
    expect(usesReasoning("anthropic", "claude-haiku-5-5", "none")).toBe(false);
    expect(usesReasoning("openai", "gpt-6-luna", "none")).toBe(false);
    expect(usesReasoning("anthropic", "claude-opus-5-5", "none")).toBe(true);
    expect(usesReasoning("vscode", "", "high")).toBe(false);
    expect(usesReasoning("openai", "gpt-6-luna", "default")).toBe(true);
    expect(usesReasoning("openrouter", "google/gemini-3.8-flash", "none")).toBe(false);
    expect(usesReasoning("xai", "grok-4.3", "none")).toBe(true);
  });
});

describe("errorKindForStatus", () => {
  it("maps HTTP statuses", () => {
    expect([400, 401, 403, 404, 413, 422, 429, 500, 503, 529, undefined].map((status) => errorKindForStatus(status))).toEqual([
      "badRequest",
      "auth",
      "permission",
      "notFound",
      "badRequest",
      "badRequest",
      "rateLimit",
      "unknown",
      "overloaded",
      "overloaded",
      "unknown",
    ]);
  });
});

describe("isAllowedBaseUrl", () => {
  it("allows HTTPS, and plain HTTP only to this machine", () => {
    const allowed = ["https://api.example.com/v1", "http://localhost:11434/v1", "http://127.0.0.1:8080", "http://[::1]:1234/v1"];
    const refused = [
      "http://example.com/v1",
      "http://localhost.example.com",
      "https://user:pass@example.com",
      "ftp://example.com",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "not a url",
      "",
    ];
    expect(allowed.filter((url) => isAllowedBaseUrl(url))).toEqual(allowed);
    expect(refused.filter((url) => isAllowedBaseUrl(url))).toEqual([]);
  });
});

describe("ProviderFactory", () => {
  const anthropic: ProviderSettings = { provider: "anthropic", model: "claude-haiku-5-5", baseUrl: "", reasoningEffort: "none" };
  const openai: ProviderSettings = { provider: "openai", model: "gpt-6-luna", baseUrl: "", reasoningEffort: "none" };

  function factoryWith(settings: ProviderSettings, keys: Partial<Record<KeyProviderId, string>>) {
    let current = settings;
    const created: string[] = [];
    const factory = new ProviderFactory(
      (provider) => keys[provider],
      () => current,
      (s, apiKey) => {
        created.push(apiKey);
        return { id: s.provider, model: s.model, translate: async () => ({ stopReason: "end" }) };
      },
    );
    return {
      factory,
      created,
      setSettings(next: ProviderSettings) {
        current = next;
      },
    };
  }

  it("needs a key for the selected provider", () => {
    const { factory, created } = factoryWith(anthropic, { openai: OPENAI_TEST_KEY });
    expect(factory.resolve()).toEqual({ ok: false, reason: "missingKey" });
    expect(created).toHaveLength(0);
  });

  it("refuses an OpenAI base URL that would expose the key", () => {
    const { factory } = factoryWith({ ...openai, baseUrl: "http://gateway.example.com/v1" }, { openai: OPENAI_TEST_KEY });
    expect(factory.resolve()).toEqual({ ok: false, reason: "invalidBaseUrl" });
  });

  it("needs no key for the VS Code Language Model API", () => {
    const { factory, created } = factoryWith({ provider: "vscode", model: "", baseUrl: "", reasoningEffort: "none" }, {});
    expect(factory.resolve().ok).toBe(true);
    expect(created).toEqual([""]);
  });

  it("needs no key for an OpenAI-compatible server on this machine", () => {
    const local = factoryWith({ ...openai, baseUrl: "http://localhost:11434/v1" }, {});
    expect(local.factory.resolve().ok).toBe(true);
    expect(local.created).toEqual([LOCAL_SERVER_KEY]);
    const stored = factoryWith({ ...openai, baseUrl: "http://127.0.0.1:1234/v1" }, { openai: OPENAI_TEST_KEY });
    stored.factory.resolve();
    expect(stored.created).toEqual([OPENAI_TEST_KEY]);
    const remote = factoryWith({ ...openai, baseUrl: "https://gateway.example.com/v1" }, {});
    expect(remote.factory.resolve()).toEqual({ ok: false, reason: "missingKey" });
  });

  it("recognizes loopback URLs", () => {
    expect(["http://localhost:11434/v1", "https://127.0.0.1", "http://[::1]:8080"].every((url) => isLoopbackUrl(url))).toBe(true);
    expect(["", "https://api.openai.com/v1", "http://localhost.example.com", "file:///tmp"].some((url) => isLoopbackUrl(url))).toBe(false);
  });

  it("reuses the provider until the settings or the key change", () => {
    const keys: Partial<Record<KeyProviderId, string>> = { anthropic: `${ANTHROPIC_TEST_KEY}-1` };
    const { factory, created, setSettings } = factoryWith(anthropic, keys);
    const first = factory.resolve();
    const second = factory.resolve();
    expect(first.ok && second.ok && first.provider === second.provider).toBe(true);
    expect(created).toHaveLength(1);

    keys.anthropic = `${ANTHROPIC_TEST_KEY}-2`;
    factory.resolve();
    setSettings({ ...anthropic, reasoningEffort: "low" });
    factory.resolve();
    factory.invalidate();
    factory.resolve();
    expect(created).toEqual([`${ANTHROPIC_TEST_KEY}-1`, `${ANTHROPIC_TEST_KEY}-2`, `${ANTHROPIC_TEST_KEY}-2`, `${ANTHROPIC_TEST_KEY}-2`]);
  });

  it("creates SDK-backed providers", () => {
    const claude = createProvider(anthropic, ANTHROPIC_TEST_KEY);
    const gpt = createProvider(openai, OPENAI_TEST_KEY);
    expect(claude).toBeInstanceOf(AnthropicProvider);
    expect(gpt).toBeInstanceOf(OpenAIProvider);
    expect([claude.model, gpt.model]).toEqual(["claude-haiku-5-5", "gpt-6-luna"]);
    expect(() => createProvider({ provider: "vscode", model: "", baseUrl: "", reasoningEffort: "none" }, "")).toThrow();
    const router = createProvider({ provider: "openrouter", model: "google/gemini-3.8-flash", baseUrl: "", reasoningEffort: "none" }, OPENAI_TEST_KEY);
    expect(router).toBeInstanceOf(OpenAIProvider);
    expect([router.id, router.model]).toEqual(["openrouter", "google/gemini-3.8-flash"]);
  });

  it("keeps each provider's key apart", () => {
    const keys: Partial<Record<KeyProviderId, string>> = { openrouter: OPENAI_TEST_KEY };
    const get = (provider: KeyProviderId) => keys[provider];
    expect(apiKeyFor({ provider: "openrouter", model: "", baseUrl: "", reasoningEffort: "none" }, get)).toBe(OPENAI_TEST_KEY);
    expect(apiKeyFor({ provider: "gemini", model: "", baseUrl: "", reasoningEffort: "none" }, get)).toBeUndefined();
    // The base URL setting belongs to OpenAI; it never makes another service keyless.
    expect(apiKeyFor({ provider: "mistral", model: "", baseUrl: "http://localhost:11434/v1", reasoningEffort: "none" }, get)).toBeUndefined();
  });
});

// The SDKs are exercised for real against a stubbed fetch: request shape, streaming, stop reasons, errors.

interface Captured {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

function stubFetch(respond: (init: RequestInit) => Response | Promise<Response>): Captured[] {
  const captured: Captured[] = [];
  vi.stubGlobal("fetch", async (input: string | URL | Request, init: RequestInit = {}) => {
    captured.push({
      url: input instanceof Request ? input.url : String(input),
      headers: new Headers(init.headers),
      body: (init.body ? JSON.parse(String(init.body)) : {}) as Record<string, unknown>,
    });
    return respond(init);
  });
  return captured;
}

function sse(events: Array<{ event?: string; data: unknown }>): Response {
  const body = events
    .map(({ event, data }) => `${event ? `event: ${event}\n` : ""}data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`)
    .join("");
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

/** An error the SDKs must not retry, so tests stay fast. */
function apiError(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-should-retry": "false" } });
}

/** Never answers; rejects once the SDK aborts the request. */
function hangingFetch(init: RequestInit): Promise<Response> {
  return new Promise((_, reject) => {
    init.signal?.addEventListener("abort", () => reject(new DOMException("This operation was aborted", "AbortError")), { once: true });
  });
}

function translateRequest(signal = new AbortController().signal): TranslateRequest & { deltas: string[] } {
  const deltas: string[] = [];
  return {
    system: "SYSTEM",
    user: '<seg id="1">Hello</seg>',
    maxOutputTokens: 1024,
    signal,
    onText: (delta) => deltas.push(delta),
    deltas,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("AnthropicProvider", () => {
  function messageStream(texts: string[], stopReason: string): Response {
    return sse([
      {
        event: "message_start",
        data: {
          type: "message_start",
          message: {
            id: "msg_test",
            type: "message",
            role: "assistant",
            model: "claude-haiku-5-5",
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 1 },
          },
        },
      },
      { event: "content_block_start", data: { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } } },
      ...texts.map((text) => ({
        event: "content_block_delta",
        data: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
      })),
      { event: "content_block_stop", data: { type: "content_block_stop", index: 0 } },
      {
        event: "message_delta",
        data: { type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 12 } },
      },
      { event: "message_stop", data: { type: "message_stop" } },
    ]);
  }

  it("streams from api.anthropic.com with thinking off and no sampling parameters", async () => {
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://elsewhere.example.com");
    const captured = stubFetch(() => messageStream(['<seg id="1">こん', "にちは</seg>"], "end_turn"));
    const request = translateRequest();
    await expect(new AnthropicProvider(ANTHROPIC_TEST_KEY, "claude-haiku-5-5", "none").translate(request)).resolves.toEqual({
      stopReason: "end",
      usage: { inputTokens: 10, outputTokens: 12 },
    });
    expect(request.deltas.join("")).toBe('<seg id="1">こんにちは</seg>');
    expect(captured).toHaveLength(1);
    const call = captured[0]!;
    const url = new URL(call.url);
    expect(url.origin + url.pathname).toBe("https://api.anthropic.com/v1/messages");
    expect(`${call.headers.get("x-api-key")} ${call.headers.get("authorization")}`).toContain(ANTHROPIC_TEST_KEY);
    expect(call.body).toMatchObject({
      model: "claude-haiku-5-5",
      max_tokens: 1024,
      system: "SYSTEM",
      messages: [{ role: "user", content: '<seg id="1">Hello</seg>' }],
      thinking: { type: "disabled" },
      stream: true,
    });
    expect(call.body).not.toHaveProperty("temperature");
  });

  it("maps stop reasons", async () => {
    const cases: Array<[string, string]> = [
      ["max_tokens", "max_tokens"],
      ["model_context_window_exceeded", "max_tokens"],
      ["refusal", "refusal"],
      ["pause_turn", "other"],
    ];
    for (const [apiReason, expected] of cases) {
      stubFetch(() => messageStream(["x"], apiReason));
      const provider = new AnthropicProvider(ANTHROPIC_TEST_KEY, "claude-haiku-5-5", "none");
      await expect(provider.translate(translateRequest())).resolves.toMatchObject({ stopReason: expected });
    }
  });

  it("maps API errors", async () => {
    const cases: Array<[number, string, string]> = [
      [401, "authentication_error", "auth"],
      [403, "permission_error", "permission"],
      [404, "not_found_error", "notFound"],
      [429, "rate_limit_error", "rateLimit"],
      [529, "overloaded_error", "overloaded"],
    ];
    for (const [status, type, kind] of cases) {
      stubFetch(() => apiError(status, { type: "error", error: { type, message: `${type} happened` } }));
      const provider = new AnthropicProvider(ANTHROPIC_TEST_KEY, "claude-haiku-5-5", "none");
      const error = await provider.translate(translateRequest()).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toMatchObject({ kind, status });
      expect((error as ProviderError).message).toContain(`${type} happened`);
    }
  });

  it("reports cancellation", async () => {
    stubFetch(hangingFetch);
    const controller = new AbortController();
    const pending = new AnthropicProvider(ANTHROPIC_TEST_KEY, "claude-haiku-5-5", "none")
      .translate(translateRequest(controller.signal))
      .catch((caught: unknown) => caught);
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();
    expect(await pending).toMatchObject({ kind: "aborted" });
  });
});

describe("OpenAIProvider", () => {
  const chunk = (delta: Record<string, unknown>, finishReason: string | null = null) => ({
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 1,
    model: "gpt-6-luna",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  });

  it("streams Chat Completions from the configured endpoint", async () => {
    const captured = stubFetch(() =>
      sse([{ data: chunk({ role: "assistant", content: '<seg id="1">こん' }) }, { data: chunk({ content: "にちは</seg>" }) }, { data: chunk({}, "stop") }, { data: "[DONE]" }]),
    );
    const request = translateRequest();
    const provider = new OpenAIProvider(OPENAI_TEST_KEY, "gpt-6-luna", "none", "https://gateway.example.com/v1");
    await expect(provider.translate(request)).resolves.toEqual({ stopReason: "end" });
    expect(request.deltas.join("")).toBe('<seg id="1">こんにちは</seg>');
    const call = captured[0]!;
    expect(call.url).toBe("https://gateway.example.com/v1/chat/completions");
    expect(call.headers.get("authorization")).toBe(`Bearer ${OPENAI_TEST_KEY}`);
    expect(call.body).toMatchObject({
      model: "gpt-6-luna",
      stream: true,
      max_completion_tokens: 1024,
      reasoning_effort: "none",
      messages: [
        { role: "system", content: "SYSTEM" },
        { role: "user", content: '<seg id="1">Hello</seg>' },
      ],
    });
    // Not every OpenAI-compatible server accepts stream options.
    expect(call.body).not.toHaveProperty("stream_options");
  });

  it("asks api.openai.com for token usage", async () => {
    const usage = { id: "chatcmpl-test", object: "chat.completion.chunk", created: 1, model: "gpt-6-luna", choices: [], usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 } };
    const captured = stubFetch(() => sse([{ data: chunk({ content: "x" }, "stop") }, { data: usage }, { data: "[DONE]" }]));
    const result = await new OpenAIProvider(OPENAI_TEST_KEY, "gpt-6-luna", "none", undefined).translate(translateRequest());
    expect(result).toEqual({ stopReason: "end", usage: { inputTokens: 20, outputTokens: 30 } });
    expect(captured[0]!.body).toMatchObject({ stream_options: { include_usage: true } });
  });

  it("uses api.openai.com and ignores OpenAI environment variables meant for other tools", async () => {
    vi.stubEnv("OPENAI_BASE_URL", "https://elsewhere.example.com/v1");
    vi.stubEnv("OPENAI_ORG_ID", "org-elsewhere");
    vi.stubEnv("OPENAI_PROJECT_ID", "proj-elsewhere");
    const captured = stubFetch(() => sse([{ data: chunk({ content: "x" }, "stop") }, { data: "[DONE]" }]));
    await new OpenAIProvider(OPENAI_TEST_KEY, "gpt-6-luna", "default", undefined).translate(translateRequest());
    const call = captured[0]!;
    expect(call.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(call.headers.get("openai-organization")).toBeNull();
    expect(call.headers.get("openai-project")).toBeNull();
    expect(call.body).not.toHaveProperty("reasoning_effort");
  });

  it("reports refusals and truncation", async () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [chunk({ refusal: "I can't help with that." }), "refusal"],
      [chunk({}, "content_filter"), "refusal"],
      [chunk({}, "length"), "max_tokens"],
    ];
    for (const [last, expected] of cases) {
      stubFetch(() => sse([{ data: chunk({ content: "x" }) }, { data: last }, { data: "[DONE]" }]));
      const provider = new OpenAIProvider(OPENAI_TEST_KEY, "gpt-6-luna", "none", undefined);
      await expect(provider.translate(translateRequest())).resolves.toEqual({ stopReason: expected });
    }
  });

  it("maps API errors", async () => {
    stubFetch(() => apiError(401, { error: { message: "Incorrect API key provided", type: "invalid_request_error", code: "invalid_api_key" } }));
    const error = await new OpenAIProvider(OPENAI_TEST_KEY, "gpt-6-luna", "none", undefined)
      .translate(translateRequest())
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ kind: "auth", status: 401 });
  });

  it("reports cancellation", async () => {
    stubFetch(hangingFetch);
    const controller = new AbortController();
    const pending = new OpenAIProvider(OPENAI_TEST_KEY, "gpt-6-luna", "none", undefined)
      .translate(translateRequest(controller.signal))
      .catch((caught: unknown) => caught);
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();
    expect(await pending).toMatchObject({ kind: "aborted" });
  });
});

describe("OpenAI-compatible services", () => {
  const chunk = (delta: Record<string, unknown>, finishReason: string | null = null) => ({
    id: "chatcmpl-test",
    object: "chat.completion.chunk",
    created: 1,
    model: "test",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  });
  const done = () => sse([{ data: chunk({ content: "x" }, "stop") }, { data: "[DONE]" }]);

  it("call each service at its own endpoint, never at a configured base URL", async () => {
    const cases: Array<[ConstructorParameters<typeof OpenAIProvider>[4], string]> = [
      ["openrouter", "https://openrouter.ai/api/v1/chat/completions"],
      ["gemini", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"],
      ["deepseek", "https://api.deepseek.com/chat/completions"],
      ["mistral", "https://api.mistral.ai/v1/chat/completions"],
      ["xai", "https://api.x.ai/v1/chat/completions"],
    ];
    for (const [provider, url] of cases) {
      const captured = stubFetch(done);
      await new OpenAIProvider(OPENAI_TEST_KEY, "model", "low", "https://elsewhere.example.com/v1", provider).translate(translateRequest());
      expect(captured[0]!.url).toBe(url);
      expect(captured[0]!.headers.get("authorization")).toBe(`Bearer ${OPENAI_TEST_KEY}`);
      expect(captured[0]!.body).toMatchObject({ max_tokens: 1024 });
      expect(captured[0]!.body).not.toHaveProperty("max_completion_tokens");
    }
  });

  it("name the app to OpenRouter and use its reasoning object", async () => {
    const captured = stubFetch(done);
    await new OpenAIProvider(OPENAI_TEST_KEY, "google/gemini-3.8-flash", "none", undefined, "openrouter").translate(translateRequest());
    expect(captured[0]!.headers.get("x-title")).toBe("Markdown Translation Preview");
    expect(captured[0]!.body).toMatchObject({ reasoning: { effort: "none" }, stream_options: { include_usage: true } });
    expect(captured[0]!.body).not.toHaveProperty("reasoning_effort");
  });

  it("do not ask Mistral for stream options", async () => {
    const captured = stubFetch(done);
    await new OpenAIProvider(OPENAI_TEST_KEY, "mistral-small-2603", "none", undefined, "mistral").translate(translateRequest());
    expect(captured[0]!.body).not.toHaveProperty("stream_options");
    expect(captured[0]!.body).toMatchObject({ reasoning_effort: "none" });
  });

  it("step down to reasoning parameters the model accepts, and remember them", async () => {
    const rejected = () => apiError(400, { error: { message: "reasoning_effort 'none' is not supported by this model", type: "invalid_request_error" } });
    let calls = 0;
    const captured = stubFetch(() => (++calls <= 2 ? rejected() : done()));
    const provider = new OpenAIProvider(OPENAI_TEST_KEY, "gemini-3.8-flash", "none", undefined, "gemini");
    await expect(provider.translate(translateRequest())).resolves.toMatchObject({ stopReason: "end" });
    await provider.translate(translateRequest());
    expect(captured.map((call) => call.body.reasoning_effort)).toEqual(["none", "minimal", "low", "low"]);
  });

  it("send no reasoning parameter once every form is rejected", async () => {
    const rejected = () => apiError(400, { error: { message: "This model does not support reasoning_effort", type: "invalid_request_error" } });
    let calls = 0;
    const captured = stubFetch(() => (++calls <= 1 ? rejected() : done()));
    await new OpenAIProvider(OPENAI_TEST_KEY, "grok-4.20", "none", undefined, "xai").translate(translateRequest());
    expect(captured.map((call) => call.body.reasoning_effort)).toEqual(["low", undefined]);
  });

  it("do not retry other bad requests", async () => {
    const captured = stubFetch(() => apiError(400, { error: { message: "messages must not be empty", type: "invalid_request_error" } }));
    const error = await new OpenAIProvider(OPENAI_TEST_KEY, "deepseek-flash", "none", undefined, "deepseek")
      .translate(translateRequest())
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ kind: "badRequest", status: 400 });
    expect(captured).toHaveLength(1);
  });
});

describe("listModels", () => {
  const list = (data: unknown[]) => new Response(JSON.stringify({ object: "list", data }), { status: 200, headers: { "content-type": "application/json" } });

  it("lists the chat models of an OpenAI-compatible service", async () => {
    const captured = stubFetch(() =>
      list([
        { id: "models/gemini-3.8-flash", object: "model", owned_by: "google" },
        { id: "models/gemini-embedding-2", object: "model", owned_by: "google" },
        { id: "models/gemini-2.5-flash-image", object: "model", owned_by: "google" },
      ]),
    );
    const models = await listModels({ provider: "gemini", model: "", baseUrl: "", reasoningEffort: "none" }, OPENAI_TEST_KEY);
    expect(models).toEqual([{ id: "gemini-3.8-flash" }]);
    expect(captured[0]!.url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/models");
  });

  it("keeps OpenRouter's display names", async () => {
    stubFetch(() => list([{ id: "google/gemini-3.8-flash", name: "Google: Gemini 3.8 Flash", object: "model" }]));
    const models = await listModels({ provider: "openrouter", model: "", baseUrl: "", reasoningEffort: "none" }, OPENAI_TEST_KEY);
    expect(models).toEqual([{ id: "google/gemini-3.8-flash", name: "Google: Gemini 3.8 Flash" }]);
  });

  it("lists Claude models", async () => {
    const captured = stubFetch(
      () =>
        new Response(
          JSON.stringify({
            data: [{ type: "model", id: "claude-haiku-5-5", display_name: "Claude Haiku 5.5", created_at: "2026-10-07T00:00:00Z" }],
            has_more: false,
            first_id: "claude-haiku-5-5",
            last_id: "claude-haiku-5-5",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const models = await listModels({ provider: "anthropic", model: "", baseUrl: "", reasoningEffort: "none" }, ANTHROPIC_TEST_KEY);
    expect(models).toEqual([{ id: "claude-haiku-5-5", name: "Claude Haiku 5.5" }]);
    expect(new URL(captured[0]!.url).origin).toBe("https://api.anthropic.com");
  });

  it("reports a rejected key", async () => {
    stubFetch(() => apiError(401, { error: { message: "Invalid API key", type: "invalid_request_error" } }));
    await expect(listModels({ provider: "deepseek", model: "", baseUrl: "", reasoningEffort: "none" }, OPENAI_TEST_KEY)).rejects.toMatchObject({
      kind: "auth",
    });
  });
});

describe("Azure and Amazon Bedrock", () => {
  const AZURE = "https://my-resource.services.ai.azure.com";
  const BEDROCK = "https://bedrock-runtime.eu-west-1.amazonaws.com";
  const chatDone = () =>
    sse([
      { data: { id: "c", object: "chat.completion.chunk", created: 1, model: "m", choices: [{ index: 0, delta: { content: "x" }, finish_reason: "stop" }] } },
      { data: "[DONE]" },
    ]);
  const messageDone = () =>
    sse([
      {
        event: "message_start",
        data: {
          type: "message_start",
          message: { id: "m", type: "message", role: "assistant", model: "m", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 3, output_tokens: 1 } },
        },
      },
      { event: "message_delta", data: { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 2 } } },
      { event: "message_stop", data: { type: "message_stop" } },
    ]);
  const settings = (provider: "azure" | "bedrock", model: string, baseUrl: string): ProviderSettings => ({ provider, model, baseUrl, reasoningEffort: "none" });

  it("send other models to the OpenAI-compatible API of the resource or region", async () => {
    let captured = stubFetch(chatDone);
    await createProvider(settings("azure", "gpt-6-luna", AZURE), OPENAI_TEST_KEY).translate(translateRequest());
    expect(captured[0]!.url).toBe(`${AZURE}/openai/v1/chat/completions`);
    expect(captured[0]!.headers.get("authorization")).toBe(`Bearer ${OPENAI_TEST_KEY}`);
    expect(captured[0]!.body).toMatchObject({ model: "gpt-6-luna", max_completion_tokens: 1024, reasoning_effort: "none" });

    captured = stubFetch(chatDone);
    await createProvider(settings("bedrock", "openai.gpt-oss-120b-1:0", BEDROCK), OPENAI_TEST_KEY).translate(translateRequest());
    expect(captured[0]!.url).toBe(`${BEDROCK}/openai/v1/chat/completions`);
    expect(captured[0]!.body).toMatchObject({ max_tokens: 1024 });
    expect(captured[0]!.body).not.toHaveProperty("stream_options");
  });

  it("send Claude to their Anthropic-compatible API", async () => {
    let captured = stubFetch(messageDone);
    const bedrock = createProvider(settings("bedrock", "global.anthropic.claude-haiku-5-5", BEDROCK), ANTHROPIC_TEST_KEY);
    expect(bedrock.id).toBe("bedrock");
    await expect(bedrock.translate(translateRequest())).resolves.toEqual({ stopReason: "end", usage: { inputTokens: 3, outputTokens: 2 } });
    expect(new URL(captured[0]!.url).href.split("?")[0]).toBe(`${BEDROCK}/anthropic/v1/messages`);
    expect(captured[0]!.headers.get("x-api-key")).toBe(ANTHROPIC_TEST_KEY);
    expect(captured[0]!.headers.get("authorization")).toBeNull();
    expect(captured[0]!.headers.get("anthropic-version")).toBe("2023-06-01");
    expect(captured[0]!.body).toMatchObject({ model: "global.anthropic.claude-haiku-5-5", thinking: { type: "disabled" } });

    captured = stubFetch(messageDone);
    await createProvider(settings("azure", "claude-haiku-5-5", AZURE), ANTHROPIC_TEST_KEY).translate(translateRequest());
    expect(new URL(captured[0]!.url).href.split("?")[0]).toBe(`${AZURE}/anthropic/v1/messages`);
  });

  it("need an HTTPS endpoint for Azure", () => {
    const factory = (baseUrl: string) => new ProviderFactory(() => OPENAI_TEST_KEY, () => settings("azure", "gpt-6-luna", baseUrl), () => {
      throw new Error("not created");
    });
    expect(factory("").resolve()).toEqual({ ok: false, reason: "invalidEndpoint" });
    expect(factory("http://my-resource.openai.azure.com").resolve()).toEqual({ ok: false, reason: "invalidEndpoint" });
  });

  it("offer known models without calling the API", async () => {
    const captured = stubFetch(() => {
      throw new Error("no request expected");
    });
    expect(await listModels(settings("bedrock", "", BEDROCK), "")).toContainEqual({ id: "global.anthropic.claude-haiku-5-5" });
    expect(await listModels(settings("azure", "", AZURE), "")).toEqual([]);
    expect(await listModels({ provider: "vertex", model: "", baseUrl: "", reasoningEffort: "none" }, "")).toContainEqual({ id: "gemini-3.8-flash" });
    expect(captured).toHaveLength(0);
  });
});

describe("Vercel AI Gateway", () => {
  it("names the app, uses the reasoning object and asks for no stream options", async () => {
    const captured = stubFetch(() =>
      sse([
        { data: { id: "c", object: "chat.completion.chunk", created: 1, model: "m", choices: [{ index: 0, delta: { content: "x" }, finish_reason: "stop" }] } },
        { data: "[DONE]" },
      ]),
    );
    await createProvider({ provider: "vercel", model: "google/gemini-3.8-flash", baseUrl: "", reasoningEffort: "none" }, OPENAI_TEST_KEY).translate(
      translateRequest(),
    );
    expect(captured[0]!.url).toBe("https://ai-gateway.vercel.sh/v1/chat/completions");
    expect(captured[0]!.headers.get("x-title")).toBe("Markdown Translation Preview");
    expect(captured[0]!.body).toMatchObject({ reasoning: { effort: "none" }, max_tokens: 1024 });
    expect(captured[0]!.body).not.toHaveProperty("stream_options");
  });

  it("lists only language models, without batch-priced copies", async () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({
            object: "list",
            data: [
              { id: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash", type: "language" },
              { id: "anthropic/claude-haiku-5.5-batch", name: "Claude Haiku 5.5 (batch)", type: "language" },
              { id: "openai/text-search-3", name: "Text Search 3", type: "reranking" },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const models = await listModels({ provider: "vercel", model: "", baseUrl: "", reasoningEffort: "none" }, OPENAI_TEST_KEY);
    expect(models).toEqual([{ id: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash" }]);
  });
});

describe("VertexProvider", () => {
  const VERTEX_TEST_KEY = "AIza-test-dummy";
  const chunk = (texts: Array<string | { text: string; thought: boolean }>, finishReason?: string, usage?: Record<string, number>) => ({
    candidates: [{ content: { role: "model", parts: texts.map((text) => (typeof text === "string" ? { text } : text)) }, ...(finishReason ? { finishReason } : {}) }],
    ...(usage ? { usageMetadata: usage } : {}),
  });
  const googleError = (status: number, message: string) =>
    new Response(JSON.stringify({ error: { code: status, message, status: "INVALID_ARGUMENT" } }), { status, headers: { "content-type": "application/json" } });

  it("streams generateContent with the key in a header", async () => {
    const captured = stubFetch(() =>
      sse([
        { data: chunk([{ text: "thinking...", thought: true }, '<seg id="1">こん']) },
        { data: chunk(["にちは</seg>"], "STOP", { promptTokenCount: 20, candidatesTokenCount: 6, thoughtsTokenCount: 4 }) },
      ]),
    );
    const request = translateRequest();
    await expect(new VertexProvider(VERTEX_TEST_KEY, "gemini-3.8-flash", "none", 0).translate(request)).resolves.toEqual({
      stopReason: "end",
      usage: { inputTokens: 20, outputTokens: 10 },
    });
    expect(request.deltas.join("")).toBe('<seg id="1">こんにちは</seg>');
    const call = captured[0]!;
    expect(call.url).toBe("https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.8-flash:streamGenerateContent?alt=sse");
    expect(call.headers.get("x-goog-api-key")).toBe(VERTEX_TEST_KEY);
    expect(call.url).not.toContain(VERTEX_TEST_KEY);
    expect(call.body).toEqual({
      contents: [{ role: "user", parts: [{ text: '<seg id="1">Hello</seg>' }] }],
      systemInstruction: { parts: [{ text: "SYSTEM" }] },
      generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: "MINIMAL" } },
    });
  });

  it("maps stop reasons", async () => {
    const cases: Array<[string, string]> = [
      ["MAX_TOKENS", "max_tokens"],
      ["SAFETY", "refusal"],
      ["OTHER", "other"],
    ];
    for (const [finishReason, stopReason] of cases) {
      stubFetch(() => sse([{ data: chunk(["x"], finishReason) }]));
      await expect(new VertexProvider(VERTEX_TEST_KEY, "gemini-3.8-flash", "default", 0).translate(translateRequest())).resolves.toMatchObject({ stopReason });
    }
  });

  it("steps down to a thinking level the model accepts, and remembers it", async () => {
    let calls = 0;
    const captured = stubFetch(() =>
      ++calls === 1 ? googleError(400, "Thinking level MINIMAL is not supported for this model.") : sse([{ data: chunk(["x"], "STOP") }]),
    );
    const provider = new VertexProvider(VERTEX_TEST_KEY, "gemini-4-flash", "none", 0);
    await provider.translate(translateRequest());
    await provider.translate(translateRequest());
    const levels = captured.map((call) => (call.body.generationConfig as { thinkingConfig?: { thinkingLevel: string } }).thinkingConfig?.thinkingLevel);
    expect(levels).toEqual(["MINIMAL", "LOW", "LOW"]);
  });

  it("retries overload and maps errors", async () => {
    let calls = 0;
    const captured = stubFetch(() => (++calls === 1 ? googleError(503, "The model is overloaded.") : sse([{ data: chunk(["x"], "STOP") }])));
    await expect(new VertexProvider(VERTEX_TEST_KEY, "gemini-3.8-flash", "none", 0).translate(translateRequest())).resolves.toMatchObject({ stopReason: "end" });
    expect(captured).toHaveLength(2);

    stubFetch(() => googleError(403, "API key not valid for this project."));
    await expect(new VertexProvider(VERTEX_TEST_KEY, "gemini-3.8-flash", "none", 0).translate(translateRequest())).rejects.toMatchObject({
      kind: "permission",
      message: "API key not valid for this project.",
    });
    stubFetch(() => googleError(404, "Publisher model not found."));
    await expect(new VertexProvider(VERTEX_TEST_KEY, "gemini-0", "none", 0).translate(translateRequest())).rejects.toMatchObject({ kind: "notFound" });
  });

  it("reports cancellation", async () => {
    stubFetch(hangingFetch);
    const controller = new AbortController();
    const pending = new VertexProvider(VERTEX_TEST_KEY, "gemini-3.8-flash", "none", 0).translate(translateRequest(controller.signal));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: "aborted" });
  });
});
