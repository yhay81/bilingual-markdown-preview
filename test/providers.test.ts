import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicProvider } from "../src/providers/anthropic";
import { ProviderFactory, createProvider, isAllowedBaseUrl, type ProviderSettings } from "../src/providers/factory";
import { OpenAIProvider } from "../src/providers/openai";
import { anthropicReasoningParams, canDisableThinking, openaiReasoningParams, usesReasoning } from "../src/providers/params";
import { ProviderError, errorKindForStatus, type ProviderId, type TranslateRequest } from "../src/providers/types";

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

  it("pass the effort through to OpenAI", () => {
    expect(openaiReasoningParams("none")).toEqual({ reasoning_effort: "none" });
    expect(openaiReasoningParams("high")).toEqual({ reasoning_effort: "high" });
    expect(openaiReasoningParams("default")).toEqual({});
  });

  it("tell when output tokens go to reasoning", () => {
    expect(usesReasoning("anthropic", "claude-haiku-5-5", "none")).toBe(false);
    expect(usesReasoning("openai", "gpt-6-luna", "none")).toBe(false);
    expect(usesReasoning("anthropic", "claude-opus-5-5", "none")).toBe(true);
    expect(usesReasoning("openai", "gpt-6-luna", "default")).toBe(true);
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

  function factoryWith(settings: ProviderSettings, keys: Partial<Record<ProviderId, string>>) {
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

  it("reuses the provider until the settings or the key change", () => {
    const keys: Partial<Record<ProviderId, string>> = { anthropic: `${ANTHROPIC_TEST_KEY}-1` };
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
      body: JSON.parse(String(init.body)) as Record<string, unknown>,
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
    await expect(new AnthropicProvider(ANTHROPIC_TEST_KEY, "claude-haiku-5-5", "none").translate(request)).resolves.toEqual({ stopReason: "end" });
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
      await expect(provider.translate(translateRequest())).resolves.toEqual({ stopReason: expected });
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
