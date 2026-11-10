import { ProviderError, type ProviderErrorKind, type StopReason, type TokenUsage, type TranslationProvider } from "../providers/types";
import type { TranslationCache } from "./cache";
import { buildSystemPrompt, buildUserMessage, type PromptSettings, type SegmentKind } from "./prompt";
import { SegStreamParser } from "./segProtocol";
import { normalizeTranslation, validateTranslation, type ValidationProblem } from "./validate";

/**
 * The translation queue shared by all previews.
 *
 * Previews ask for the segments they show; the service deduplicates them, answers from the cache,
 * batches the rest into requests (nearest the reader's position first), streams results back
 * segment by segment, retries bad segments on their own, and pauses everything while the API key
 * or configuration is unusable.
 */

export const MAX_ATTEMPTS = 3;
export const MAX_SEGMENTS_PER_BATCH = 40;

export interface TranslationJob {
  key: string;
  masked: string;
  placeholders: readonly string[];
  /** Document line of the segment, for ordering. */
  line: number;
  /** Inline Markdown unless said otherwise. */
  kind?: SegmentKind;
  /** Language to translate into when the document sets its own; otherwise the configured one. */
  targetLanguage?: string;
}

export interface JobError {
  kind: ProviderErrorKind | "refusal" | "truncated" | "invalid";
  message: string;
}

export type TranslationResult =
  | { state: "queued" }
  | { state: "inflight" }
  /** `problems` is non-empty when the best attempt still failed validation. */
  | { state: "done"; text: string; problems: ValidationProblem[] }
  | { state: "error"; error: JobError };

type FinalResult = Extract<TranslationResult, { state: "done" | "error" }>;

export type ProviderResolution =
  | { ok: true; provider: TranslationProvider }
  | { ok: false; reason: "missingKey" | "invalidBaseUrl" };

export type BlockReason = "missingKey" | "invalidBaseUrl" | "auth" | "permission" | "notFound" | "tokenLimit";

export interface Block {
  reason: BlockReason;
  message?: string;
}

export interface ServiceConfig {
  prompt: PromptSettings;
  maxConcurrentRequests: number;
  batchCharacterLimit: number;
  /** Leave room in the output budget for reasoning tokens. */
  usesReasoning: boolean;
  /** Tokens after which translation pauses until `resume`, or 0 for no limit. */
  tokenLimit: number;
}

export interface ServiceDependencies {
  cache: TranslationCache;
  resolveProvider(): ProviderResolution;
  getConfig(): ServiceConfig;
}

export interface ServiceChange {
  /** Keys whose result changed. */
  keys: string[];
  /** The block or the last error changed. */
  stateChanged: boolean;
}

interface Entry {
  key: string;
  masked: string;
  placeholderCount: number;
  kind: SegmentKind;
  targetLanguage: string | undefined;
  state: "queued" | "inflight";
  attempts: number;
  /** Send alone: set after the segment failed inside a batch. */
  solo: boolean;
  best?: { text: string; problems: ValidationProblem[] };
}

interface Batch {
  entries: Entry[];
  controller: AbortController;
}

const BLOCKING_KINDS: ReadonlySet<ProviderErrorKind> = new Set(["auth", "permission", "notFound"]);

export class TranslationService {
  /** Queued and in-flight work. An entry is live only while it is the one stored here. */
  private readonly pending = new Map<string, Entry>();
  /** Final results of this session that are not in the cache: errors and flawed translations. */
  private readonly results = new Map<string, FinalResult>();
  /** Per owner (preview): the jobs it wants, by key. */
  private readonly wanted = new Map<string, Map<string, TranslationJob>>();
  private readonly focus = new Map<string, number>();
  private readonly batches = new Set<Batch>();
  private readonly listeners = new Set<(change: ServiceChange) => void>();
  private activeOwner: string | undefined;
  private block: Block | undefined;
  private lastError: JobError | undefined;
  private readonly usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  /** Tokens used since the session started or the token limit was last lifted. */
  private tokensSinceResume = 0;
  private changedKeys = new Set<string>();
  private stateChanged = false;
  private emitScheduled = false;
  private disposed = false;

  constructor(private readonly deps: ServiceDependencies) {}

  onDidChange(listener: (change: ServiceChange) => void): { dispose(): void } {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  /** Replaces everything `owner` wants translated. Work nobody wants any more is dropped. */
  request(owner: string, jobs: readonly TranslationJob[]): void {
    const byKey = new Map<string, TranslationJob>();
    for (const job of jobs) {
      if (byKey.has(job.key)) continue;
      byKey.set(job.key, job);
      if (!this.results.has(job.key) && this.deps.cache.get(job.key) === undefined) this.enqueue(job);
    }
    this.wanted.set(owner, byKey);
    this.prune();
    this.pump();
  }

  getResult(key: string): TranslationResult | undefined {
    const result = this.results.get(key);
    if (result) return result;
    const cached = this.deps.cache.get(key);
    if (cached !== undefined) return { state: "done", text: cached, problems: [] };
    const entry = this.pending.get(key);
    return entry ? { state: entry.state } : undefined;
  }

  getBlock(): Block | undefined {
    return this.block;
  }

  getLastError(): JobError | undefined {
    return this.lastError;
  }

  /** Tokens reported by the API in this session, over all previews. */
  getUsage(): TokenUsage {
    return { ...this.usage };
  }

  /** Drops the final results of `keys` (errors and flawed translations) and queues them again. */
  retry(keys: Iterable<string>): void {
    let changed = false;
    for (const key of keys) {
      if (!this.results.delete(key)) continue;
      changed = true;
      this.changedKeys.add(key);
      const job = this.findJob(key);
      if (job) this.enqueue(job);
    }
    if (!changed) return;
    this.scheduleEmit();
    this.pump();
  }

  /** Forgets everything known about `keys`, including the cache, so they are translated afresh. */
  forget(keys: Iterable<string>): void {
    const forgotten: string[] = [];
    for (const key of keys) {
      this.results.delete(key);
      this.pending.delete(key);
      forgotten.push(key);
      this.changedKeys.add(key);
    }
    this.deps.cache.delete(forgotten);
    this.abortDeadBatches();
    this.scheduleEmit();
  }

  /** Continues after the user chose to: lifts the token limit for another round, and retries a block. */
  resume(): void {
    if (this.block?.reason === "tokenLimit") this.tokensSinceResume = 0;
    this.unblock();
  }

  /** Clears the pause after the API key or configuration changed. */
  unblock(): void {
    if (this.block) {
      this.block = undefined;
      this.stateChanged = true;
      this.scheduleEmit();
    }
    this.pump();
  }

  /** Starts over, for example after a setting that changes translations. Previews request again. */
  reset(): void {
    for (const batch of this.batches) batch.controller.abort();
    this.batches.clear();
    this.pending.clear();
    this.results.clear();
    this.block = undefined;
    this.lastError = undefined;
    this.stateChanged = true;
    this.scheduleEmit();
  }

  setFocus(owner: string, line: number): void {
    this.focus.set(owner, line);
  }

  setActiveOwner(owner: string | undefined): void {
    this.activeOwner = owner;
  }

  release(owner: string): void {
    this.wanted.delete(owner);
    this.focus.delete(owner);
    if (this.activeOwner === owner) this.activeOwner = undefined;
    this.prune();
  }

  /** Starts queued work, for example after the concurrency limit was raised. */
  kick(): void {
    this.pump();
  }

  dispose(): void {
    this.disposed = true;
    for (const batch of this.batches) batch.controller.abort();
    this.batches.clear();
    this.pending.clear();
    this.listeners.clear();
  }

  private isWanted(key: string): boolean {
    for (const keys of this.wanted.values()) if (keys.has(key)) return true;
    return false;
  }

  private isLive(entry: Entry): boolean {
    return this.pending.get(entry.key) === entry;
  }

  private findJob(key: string): TranslationJob | undefined {
    for (const jobs of this.wanted.values()) {
      const job = jobs.get(key);
      if (job) return job;
    }
    return undefined;
  }

  private enqueue(job: TranslationJob): void {
    if (this.pending.has(job.key)) return;
    this.pending.set(job.key, {
      key: job.key,
      masked: job.masked,
      placeholderCount: job.placeholders.length,
      kind: job.kind ?? "markdown",
      targetLanguage: job.targetLanguage,
      state: "queued",
      attempts: 0,
      solo: false,
    });
  }

  private prune(): void {
    for (const [key, entry] of this.pending) {
      if (entry.state === "queued" && !this.isWanted(key)) this.pending.delete(key);
    }
    for (const batch of this.batches) {
      if (batch.entries.every((entry) => !this.isWanted(entry.key))) {
        for (const entry of batch.entries) if (this.isLive(entry)) this.pending.delete(entry.key);
      }
    }
    this.abortDeadBatches();
  }

  /** Aborts requests whose segments are all forgotten or unwanted. */
  private abortDeadBatches(): void {
    for (const batch of this.batches) {
      if (batch.entries.some((entry) => this.isLive(entry))) continue;
      batch.controller.abort();
      this.batches.delete(batch);
    }
  }

  private pump(): void {
    if (this.disposed) return;
    const config = this.deps.getConfig();
    const overLimit = config.tokenLimit > 0 && this.tokensSinceResume >= config.tokenLimit;
    if (this.block?.reason === "tokenLimit" && !overLimit) {
      // The limit was raised or removed.
      this.block = undefined;
      this.stateChanged = true;
      this.scheduleEmit();
    }
    if (this.block) return;
    while (this.batches.size < config.maxConcurrentRequests) {
      const entries = this.takeBatch(config.batchCharacterLimit);
      if (entries.length === 0) return;
      if (overLimit) {
        this.setBlock({ reason: "tokenLimit" });
        return;
      }
      const resolution = this.deps.resolveProvider();
      if (!resolution.ok) {
        this.setBlock({ reason: resolution.reason });
        return;
      }
      const batch: Batch = { entries, controller: new AbortController() };
      for (const entry of entries) entry.state = "inflight";
      this.batches.add(batch);
      for (const entry of entries) this.changedKeys.add(entry.key);
      this.scheduleEmit();
      void this.runBatch(batch, resolution.provider, config);
    }
  }

  private takeBatch(charLimit: number): Entry[] {
    const queued: Array<{ entry: Entry; tier: number; order: number }> = [];
    for (const entry of this.pending.values()) {
      if (entry.state === "queued") queued.push({ entry, ...this.priority(entry.key) });
    }
    if (queued.length === 0) return [];
    queued.sort((a, b) => a.tier - b.tier || a.order - b.order);

    const first = queued[0]!.entry;
    if (first.solo) return [first];
    const batch = [first];
    let chars = first.masked.length;
    for (let i = 1; i < queued.length && batch.length < MAX_SEGMENTS_PER_BATCH; i++) {
      const entry = queued[i]!.entry;
      // One request translates into one language.
      if (entry.solo || entry.targetLanguage !== first.targetLanguage) continue;
      // Stop rather than skip, so a batch stays a contiguous stretch of the document.
      if (chars + entry.masked.length > charLimit) break;
      batch.push(entry);
      chars += entry.masked.length;
    }
    return batch;
  }

  /** Lower sorts first: the active preview from its scroll position down, then above it, then the rest. */
  private priority(key: string): { tier: number; order: number } {
    const active = this.activeOwner;
    const line = active === undefined ? undefined : this.wanted.get(active)?.get(key)?.line;
    if (active !== undefined && line !== undefined) {
      const focus = this.focus.get(active) ?? 0;
      return line >= focus - 3 ? { tier: 0, order: line } : { tier: 1, order: focus - line };
    }
    let order = Number.POSITIVE_INFINITY;
    for (const jobs of this.wanted.values()) order = Math.min(order, jobs.get(key)?.line ?? order);
    return { tier: 2, order };
  }

  private async runBatch(batch: Batch, provider: TranslationProvider, config: ServiceConfig): Promise<void> {
    const byId = new Map(batch.entries.map((entry, index) => [index + 1, entry] as const));
    const received = new Set<Entry>();
    const parser = new SegStreamParser((id, raw) => {
      const entry = byId.get(id);
      if (!entry || received.has(entry) || batch.controller.signal.aborted) return;
      received.add(entry);
      if (this.isLive(entry)) this.accept(entry, raw);
    });
    const chars = batch.entries.reduce((sum, entry) => sum + entry.masked.length, 0);
    const first = batch.entries[0]!;
    const prompt = first.targetLanguage ? { ...config.prompt, targetLanguage: first.targetLanguage } : config.prompt;

    try {
      const result = await provider.translate({
        system: buildSystemPrompt(prompt, { comments: batch.entries.some((entry) => entry.kind === "comment") }),
        user: buildUserMessage(batch.entries.map((entry, index) => ({ id: index + 1, text: entry.masked, kind: entry.kind }))),
        maxOutputTokens: maxOutputTokens(chars, batch.entries.length, config.usesReasoning),
        signal: batch.controller.signal,
        onText: (delta) => parser.push(delta),
      });
      if (result.usage) this.addUsage(result.usage);
      if (batch.controller.signal.aborted) return;
      parser.finish(result.stopReason === "end" || result.stopReason === "other");
      const missing = missingError(result.stopReason);
      for (const entry of batch.entries) {
        if (!received.has(entry) && this.isLive(entry)) this.retryOrFail(entry, missing);
      }
      if (this.lastError) {
        this.lastError = undefined;
        this.stateChanged = true;
      }
    } catch (error) {
      if (batch.controller.signal.aborted) return;
      const failure =
        error instanceof ProviderError ? error : new ProviderError("unknown", error instanceof Error ? error.message : String(error));
      const unfinished = batch.entries.filter((entry) => !received.has(entry) && this.isLive(entry));
      if (BLOCKING_KINDS.has(failure.kind)) {
        for (const entry of unfinished) entry.state = "queued";
        this.setBlock({ reason: failure.kind as BlockReason, message: failure.message });
      } else {
        const jobError: JobError = { kind: failure.kind, message: failure.message };
        this.lastError = jobError;
        this.stateChanged = true;
        for (const entry of unfinished) this.finish(entry, { state: "error", error: jobError });
      }
    } finally {
      if (this.batches.delete(batch)) {
        this.scheduleEmit();
        this.pump();
      }
    }
  }

  private accept(entry: Entry, raw: string): void {
    const text = normalizeTranslation(raw);
    const problems = validateTranslation(entry.masked, text, entry.placeholderCount, entry.kind === "markdown");
    if (problems.length === 0) {
      this.deps.cache.set(entry.key, text);
      this.pending.delete(entry.key);
      this.changedKeys.add(entry.key);
      this.scheduleEmit();
      return;
    }
    if (text && (!entry.best || problems.length < entry.best.problems.length)) entry.best = { text, problems };
    this.retryOrFail(entry, { kind: "invalid", message: `The translation failed validation (${problems.join(", ")}).` });
  }

  private retryOrFail(entry: Entry, error: JobError): void {
    entry.attempts++;
    if (!this.isWanted(entry.key)) {
      this.pending.delete(entry.key);
      return;
    }
    if (entry.attempts < MAX_ATTEMPTS) {
      entry.state = "queued";
      entry.solo = true;
      this.changedKeys.add(entry.key);
      this.scheduleEmit();
      return;
    }
    if (entry.best) this.finish(entry, { state: "done", text: entry.best.text, problems: entry.best.problems });
    else this.finish(entry, { state: "error", error });
  }

  private finish(entry: Entry, result: FinalResult): void {
    this.pending.delete(entry.key);
    this.results.set(entry.key, result);
    this.changedKeys.add(entry.key);
    this.scheduleEmit();
  }

  private addUsage(usage: TokenUsage): void {
    this.usage.inputTokens += usage.inputTokens;
    this.usage.outputTokens += usage.outputTokens;
    this.tokensSinceResume += usage.inputTokens + usage.outputTokens;
    this.stateChanged = true;
    this.scheduleEmit();
  }

  private setBlock(block: Block): void {
    this.block = block;
    this.stateChanged = true;
    this.scheduleEmit();
  }

  /** Coalesces changes into one event per microtask. */
  private scheduleEmit(): void {
    if (this.emitScheduled || this.disposed) return;
    this.emitScheduled = true;
    queueMicrotask(() => {
      this.emitScheduled = false;
      const change: ServiceChange = { keys: [...this.changedKeys], stateChanged: this.stateChanged };
      this.changedKeys = new Set();
      this.stateChanged = false;
      if (change.keys.length === 0 && !change.stateChanged) return;
      for (const listener of this.listeners) listener(change);
    });
  }
}

/** Output budget: translations run about as long as the source in tokens, plus tags and slack. */
export function maxOutputTokens(chars: number, segments: number, usesReasoning: boolean): number {
  const estimate = Math.ceil(chars * 1.5) + 512 + 16 * segments;
  return Math.min(32_000, Math.max(1_024, estimate)) + (usesReasoning ? 8_192 : 0);
}

function missingError(stopReason: StopReason): JobError {
  switch (stopReason) {
    case "max_tokens":
      return { kind: "truncated", message: "The response was cut off before this segment." };
    case "refusal":
      return { kind: "refusal", message: "The model declined to translate this segment." };
    default:
      return { kind: "invalid", message: "The response did not include this segment." };
  }
}
