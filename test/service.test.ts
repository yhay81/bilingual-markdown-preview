import { describe, expect, it } from "vitest";
import {
  ProviderError,
  type StopReason,
  type TokenUsage,
  type TranslateRequest,
  type TranslateResult,
  type TranslationProvider,
} from "../src/providers/types";
import { TranslationCache } from "../src/translate/cache";
import {
  MAX_ATTEMPTS,
  MAX_SEGMENTS_PER_BATCH,
  TranslationService,
  maxOutputTokens,
  type ProviderResolution,
  type ServiceChange,
  type ServiceConfig,
  type TranslationJob,
} from "../src/translate/service";

interface Segment {
  id: number;
  text: string;
}

interface Reply {
  output: string;
  stopReason?: StopReason;
}

type Handler = (segments: Segment[], request: TranslateRequest) => Reply | Promise<Reply>;

function segmentsOf(user: string): Segment[] {
  return [...user.matchAll(/<seg id="(\d+)"[^>]*>([\s\S]*?)<\/seg>/g)].map((match) => ({ id: Number(match[1]), text: match[2]! }));
}

/** A well-formed response; `translate` returning undefined leaves that segment out. */
function reply(segments: Segment[], translate: (text: string) => string | undefined = (text) => `訳:${text}`): Reply {
  const parts: string[] = [];
  for (const segment of segments) {
    const text = translate(segment.text);
    if (text !== undefined) parts.push(`<seg id="${segment.id}">${text}</seg>`);
  }
  return { output: parts.join("\n") };
}

/** Never answers; rejects like the SDKs do once the request is cancelled. */
function hang(request: TranslateRequest): Promise<never> {
  return new Promise((_, reject) => {
    request.signal.addEventListener("abort", () => reject(new ProviderError("aborted", "The request was cancelled.")), { once: true });
  });
}

class FakeProvider implements TranslationProvider {
  readonly id = "anthropic";
  readonly model = "fake-model";
  readonly requests: TranslateRequest[] = [];
  handler: Handler = (segments) => reply(segments);
  /** Reported with every response when set. */
  usage: TokenUsage | undefined;

  async translate(request: TranslateRequest): Promise<TranslateResult> {
    this.requests.push(request);
    const { output, stopReason = "end" } = await this.handler(segmentsOf(request.user), request);
    // Stream in small pieces, as the real APIs do.
    for (let i = 0; i < output.length; i += 7) request.onText(output.slice(i, i + 7));
    return this.usage ? { stopReason, usage: this.usage } : { stopReason };
  }

  /** The source texts of each request, in order. */
  sent(): string[][] {
    return this.requests.map((request) => segmentsOf(request.user).map((segment) => segment.text));
  }
}

function setup(overrides: Partial<ServiceConfig> = {}) {
  const cache = new TranslationCache();
  const provider = new FakeProvider();
  const config: ServiceConfig = {
    prompt: { targetLanguage: "Japanese", styleInstructions: "", glossary: {} },
    maxConcurrentRequests: 3,
    batchCharacterLimit: 4000,
    usesReasoning: false,
    tokenLimit: 0,
    ...overrides,
  };
  let resolution: ProviderResolution = { ok: true, provider };
  const service = new TranslationService({ cache, resolveProvider: () => resolution, getConfig: () => config });
  const changes: ServiceChange[] = [];
  service.onDidChange((change) => changes.push(change));
  return {
    service,
    cache,
    provider,
    changes,
    setResolution(next: ProviderResolution) {
      resolution = next;
    },
  };
}

function job(key: string, line = 0, masked = `Text ${key}`, placeholders: string[] = []): TranslationJob {
  return { key, masked, placeholders, line };
}

/** Lets the fake requests, retries and change events run to completion. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("TranslationService", () => {
  it("translates segments in one streamed batch, in document order, and caches them", async () => {
    const { service, cache, provider, changes } = setup();
    service.request("p1", [job("b", 1, "World"), job("a", 0, "Hello")]);
    expect(service.getResult("a")).toEqual({ state: "inflight" });
    await settle();
    expect(provider.sent()).toEqual([["Hello", "World"]]);
    expect(provider.requests[0]!.system).toContain("into Japanese");
    expect(service.getResult("a")).toEqual({ state: "done", text: "訳:Hello", problems: [] });
    expect(cache.get("b")).toBe("訳:World");
    expect(new Set(changes.flatMap((change) => change.keys))).toEqual(new Set(["a", "b"]));
  });

  it("answers from the cache and asks once for segments several previews want", async () => {
    const { service, cache, provider } = setup();
    cache.set("cached", "キャッシュ済み");
    service.request("p1", [job("cached"), job("a")]);
    service.request("p2", [job("a"), job("a")]);
    await settle();
    expect(provider.sent()).toEqual([["Text a"]]);
    expect(service.getResult("cached")).toEqual({ state: "done", text: "キャッシュ済み", problems: [] });
  });

  it("splits batches at the character limit and runs only so many at once", async () => {
    const { service, provider } = setup({ batchCharacterLimit: 10, maxConcurrentRequests: 2 });
    service.request(
      "p1",
      ["a", "b", "c", "d", "e"].map((key, line) => job(key, line, key.repeat(5))),
    );
    expect(provider.requests).toHaveLength(2);
    await settle();
    expect(provider.sent()).toEqual([["aaaaa", "bbbbb"], ["ccccc", "ddddd"], ["eeeee"]]);
  });

  it("caps the number of segments in one request", async () => {
    const { service, provider } = setup({ maxConcurrentRequests: 1 });
    service.request(
      "p1",
      Array.from({ length: MAX_SEGMENTS_PER_BATCH + 5 }, (_, i) => job(`k${i}`, i, `t${i}`)),
    );
    await settle();
    expect(provider.sent().map((texts) => texts.length)).toEqual([MAX_SEGMENTS_PER_BATCH, 5]);
  });

  it("budgets output tokens from the batch size", () => {
    expect(maxOutputTokens(10, 2, false)).toBe(1024);
    expect(maxOutputTokens(4000, 10, false)).toBe(6000 + 512 + 160);
    expect(maxOutputTokens(100_000, 40, false)).toBe(32_000);
    expect(maxOutputTokens(4000, 10, true)).toBe(6000 + 512 + 160 + 8192);
    const { service, provider } = setup({ usesReasoning: true });
    service.request("p1", [job("a", 0, "Hello")]);
    expect(provider.requests[0]!.maxOutputTokens).toBe(1024 + 8192);
  });

  it("retries a segment that fails validation on its own, then keeps the best attempt", async () => {
    const { service, cache, provider } = setup();
    provider.handler = (segments) => reply(segments, (text) => (text.includes("⟦1⟧") ? "コードを実行" : `訳:${text}`));
    service.request("p1", [job("code", 0, "Run ⟦1⟧", ["`npm test`"]), job("plain", 1, "Plain")]);
    await settle();
    expect(provider.sent()).toEqual([["Run ⟦1⟧", "Plain"], ["Run ⟦1⟧"], ["Run ⟦1⟧"]]);
    expect(provider.requests).toHaveLength(MAX_ATTEMPTS);
    expect(service.getResult("plain")).toEqual({ state: "done", text: "訳:Plain", problems: [] });
    expect(service.getResult("code")).toEqual({ state: "done", text: "コードを実行", problems: ["missingPlaceholders"] });
    expect(cache.get("code")).toBeUndefined();
  });

  it("sends code comments with their own rules and does not count their brackets", async () => {
    const { service, cache, provider } = setup();
    provider.handler = (segments) => reply(segments, (text) => (text.startsWith("see") ? "x と ⟦1⟧ を参照" : `訳:${text}`));
    service.request("p1", [{ ...job("comment", 0, "see [x] and ⟦1⟧", ["`f()`"]), kind: "comment" }]);
    await settle();
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]!.system).toContain('kind="comment"');
    expect(provider.requests[0]!.user).toBe('<seg id="1" kind="comment">see [x] and ⟦1⟧</seg>');
    expect(service.getResult("comment")).toEqual({ state: "done", text: "x と ⟦1⟧ を参照", problems: [] });
    expect(cache.get("comment")).toBe("x と ⟦1⟧ を参照");

    service.request("p1", [job("prose", 1, "Hello")]);
    await settle();
    expect(provider.requests[1]!.system).not.toContain('kind="comment"');
  });

  it("caches a later attempt that passes validation", async () => {
    const { service, cache, provider } = setup();
    let calls = 0;
    provider.handler = (segments) => reply(segments, () => (++calls === 1 ? "壊れた [リンク" : "[リンク]⟦1⟧"));
    service.request("p1", [job("link", 0, "[link]⟦1⟧", ["(https://example.com)"])]);
    await settle();
    expect(provider.requests).toHaveLength(2);
    expect(cache.get("link")).toBe("[リンク]⟦1⟧");
  });

  it("asks again for segments missing from the response", async () => {
    const { service, provider } = setup();
    let calls = 0;
    provider.handler = (segments) => (++calls === 1 ? reply(segments.slice(0, 1)) : reply(segments));
    service.request("p1", [job("a", 0), job("b", 1)]);
    await settle();
    expect(provider.sent()).toEqual([["Text a", "Text b"], ["Text b"]]);
    expect(service.getResult("b")).toEqual({ state: "done", text: "訳:Text b", problems: [] });
  });

  it("does not trust a final segment cut off by the output limit", async () => {
    const { service, provider } = setup();
    let calls = 0;
    provider.handler = (segments) => (++calls === 1 ? { output: '<seg id="1">途中で切れ', stopReason: "max_tokens" } : reply(segments));
    service.request("p1", [job("a")]);
    await settle();
    expect(provider.requests).toHaveLength(2);
    expect(service.getResult("a")).toEqual({ state: "done", text: "訳:Text a", problems: [] });
  });

  it("gives up after the last attempt and says why", async () => {
    const { service, provider } = setup();
    provider.handler = () => ({ output: "", stopReason: "refusal" });
    service.request("p1", [job("a")]);
    await settle();
    expect(provider.requests).toHaveLength(MAX_ATTEMPTS);
    expect(service.getResult("a")).toMatchObject({ state: "error", error: { kind: "refusal" } });
  });

  it("pauses without an API key and resumes when unblocked", async () => {
    const { service, provider, changes, setResolution } = setup();
    setResolution({ ok: false, reason: "missingKey" });
    service.request("p1", [job("a")]);
    expect(service.getBlock()).toEqual({ reason: "missingKey" });
    expect(service.getResult("a")).toEqual({ state: "queued" });
    await settle();
    expect(changes.some((change) => change.stateChanged)).toBe(true);

    setResolution({ ok: true, provider });
    service.unblock();
    expect(service.getBlock()).toBeUndefined();
    await settle();
    expect(service.getResult("a")).toMatchObject({ state: "done" });
  });

  it("pauses when the key is rejected and queues the unfinished segments again", async () => {
    const { service, provider } = setup();
    provider.handler = () => {
      throw new ProviderError("auth", "invalid x-api-key", { status: 401 });
    };
    service.request("p1", [job("a"), job("b", 1)]);
    await settle();
    expect(service.getBlock()).toEqual({ reason: "auth", message: "invalid x-api-key" });
    expect(service.getResult("a")).toEqual({ state: "queued" });
    service.request("p1", [job("a"), job("b", 1)]);
    expect(provider.requests).toHaveLength(1);

    provider.handler = (segments) => reply(segments);
    service.unblock();
    await settle();
    expect(provider.requests).toHaveLength(2);
    expect(service.getResult("b")).toMatchObject({ state: "done" });
  });

  it("fails the batch on other errors, remembers the error, and retries on demand", async () => {
    const { service, provider } = setup();
    provider.handler = () => {
      throw new ProviderError("rateLimit", "Too many requests", { status: 429 });
    };
    service.request("p1", [job("a")]);
    await settle();
    expect(service.getBlock()).toBeUndefined();
    expect(service.getResult("a")).toEqual({ state: "error", error: { kind: "rateLimit", message: "Too many requests" } });
    expect(service.getLastError()).toEqual({ kind: "rateLimit", message: "Too many requests" });

    // Asking again does not hammer the API; retrying does.
    service.request("p1", [job("a")]);
    expect(provider.requests).toHaveLength(1);
    provider.handler = (segments) => reply(segments);
    service.retry(["a"]);
    await settle();
    expect(service.getResult("a")).toMatchObject({ state: "done" });
    expect(service.getLastError()).toBeUndefined();
  });

  it("treats unexpected exceptions as unknown errors", async () => {
    const { service, provider } = setup();
    provider.handler = () => {
      throw new TypeError("boom");
    };
    service.request("p1", [job("a")]);
    await settle();
    expect(service.getResult("a")).toEqual({ state: "error", error: { kind: "unknown", message: "boom" } });
  });

  it("drops work no preview wants and cancels its requests", async () => {
    const { service, provider } = setup();
    provider.handler = (_segments, request) => hang(request);
    service.request("p1", [job("a")]);
    service.request("p2", [job("b", 1)]);
    expect(provider.requests).toHaveLength(2);

    service.request("p1", []);
    expect(provider.requests[0]!.signal.aborted).toBe(true);
    expect(provider.requests[1]!.signal.aborted).toBe(false);
    service.release("p2");
    expect(provider.requests[1]!.signal.aborted).toBe(true);
    await settle();
    expect(service.getResult("a")).toBeUndefined();
    expect(service.getLastError()).toBeUndefined();
  });

  it("works from the active preview's position down, then up, then on other previews", async () => {
    const { service, provider, setResolution } = setup({ maxConcurrentRequests: 1, batchCharacterLimit: 1 });
    setResolution({ ok: false, reason: "missingKey" });
    service.setActiveOwner("p1");
    service.setFocus("p1", 10);
    service.request("p2", [job("other", 0, "other")]);
    service.request(
      "p1",
      [0, 5, 8, 12, 20].map((line) => job(`l${line}`, line, `line ${line}`)),
    );
    setResolution({ ok: true, provider });
    service.unblock();
    await settle();
    expect(provider.sent().flat()).toEqual(["line 8", "line 12", "line 20", "line 5", "line 0", "other"]);
  });

  it("forgets cached and in-flight results so the next request translates afresh", async () => {
    const { service, cache, provider } = setup();
    service.request("p1", [job("a")]);
    await settle();
    expect(cache.get("a")).toBe("訳:Text a");

    service.forget(["a"]);
    expect(cache.get("a")).toBeUndefined();
    expect(service.getResult("a")).toBeUndefined();

    provider.handler = (_segments, request) => hang(request);
    service.request("p1", [job("a")]);
    expect(provider.requests).toHaveLength(2);
    service.forget(["a"]);
    expect(provider.requests[1]!.signal.aborted).toBe(true);
  });

  it("ignores responses that arrive after a reset", async () => {
    const { service, cache, provider } = setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    provider.handler = async (segments) => {
      await gate;
      return reply(segments);
    };
    service.request("p1", [job("a")]);
    service.reset();
    expect(provider.requests[0]!.signal.aborted).toBe(true);
    release();
    await settle();
    expect(cache.size).toBe(0);
    expect(service.getResult("a")).toBeUndefined();
  });

  it("adds up token usage and pauses at the token limit until resumed", async () => {
    const { service, provider } = setup({ tokenLimit: 100, batchCharacterLimit: 10, maxConcurrentRequests: 1 });
    provider.usage = { inputTokens: 40, outputTokens: 30 };
    service.request("p1", ["a", "b", "c"].map((key, line) => job(key, line, key.repeat(8))));
    await settle();
    await settle();
    // 70 tokens after the first request, 140 after the second: the third waits.
    expect(provider.requests).toHaveLength(2);
    expect(service.getUsage()).toEqual({ inputTokens: 80, outputTokens: 60 });
    expect(service.getBlock()).toEqual({ reason: "tokenLimit" });
    expect(service.getResult("c")).toEqual({ state: "queued" });

    service.unblock();
    await settle();
    expect(provider.requests).toHaveLength(2);

    service.resume();
    await settle();
    expect(provider.requests).toHaveLength(3);
    expect(service.getResult("c")?.state).toBe("done");
  });

  it("lifts the token limit pause when the limit is raised", async () => {
    let limit = 50;
    const { service, provider } = setup({ batchCharacterLimit: 10, maxConcurrentRequests: 1 });
    const config = { prompt: { targetLanguage: "Japanese", styleInstructions: "", glossary: {} }, maxConcurrentRequests: 1, batchCharacterLimit: 10, usesReasoning: false };
    const limited = new TranslationService({
      cache: new TranslationCache(),
      resolveProvider: () => ({ ok: true, provider }),
      getConfig: () => ({ ...config, tokenLimit: limit }),
    });
    provider.usage = { inputTokens: 40, outputTokens: 30 };
    limited.request("p1", ["a", "b"].map((key, line) => job(key, line, key.repeat(8))));
    await settle();
    expect(limited.getBlock()?.reason).toBe("tokenLimit");
    limit = 0;
    limited.kick();
    await settle();
    expect(limited.getBlock()).toBeUndefined();
    expect(limited.getResult("b")?.state).toBe("done");
    service.dispose();
  });
});
