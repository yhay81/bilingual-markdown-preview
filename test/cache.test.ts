import { afterEach, describe, expect, it, vi } from "vitest";
import { TranslationCache, type CacheStore } from "../src/translate/cache";

class MemoryStore implements CacheStore {
  writes = 0;
  failNextWrite = false;

  constructor(public data?: string) {}

  async read(): Promise<string | undefined> {
    return this.data;
  }

  async write(data: string): Promise<void> {
    this.writes++;
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error("disk full");
    }
    this.data = data;
  }
}

const file = (entries: unknown) => JSON.stringify({ version: 1, entries });

describe("TranslationCache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("evicts the least recently used entry", () => {
    const cache = new TranslationCache(undefined, 2);
    cache.set("a", "A");
    cache.set("b", "B");
    expect(cache.get("a")).toBe("A");
    cache.set("c", "C");
    expect(cache.get("b")).toBeUndefined();
    expect([cache.get("a"), cache.get("c"), cache.size]).toEqual(["A", "C", 2]);
  });

  it("saves to its store and loads back", async () => {
    const store = new MemoryStore();
    const cache = new TranslationCache(store);
    cache.set("k", "訳");
    await cache.flush();
    const loaded = new TranslationCache(store);
    await loaded.load();
    expect(loaded.get("k")).toBe("訳");
    await cache.flush();
    expect(store.writes).toBe(1);
  });

  it("saves in the background a while after a change", async () => {
    vi.useFakeTimers();
    const store = new MemoryStore();
    const cache = new TranslationCache(store, 100, 2000);
    cache.set("a", "A");
    cache.set("b", "B");
    await vi.advanceTimersByTimeAsync(1999);
    expect(store.writes).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(store.writes).toBe(1);
    expect(JSON.parse(store.data!)).toEqual({ version: 1, entries: [["a", "A"], ["b", "B"]] });
  });

  it("starts empty from a corrupt or unknown cache file and skips malformed entries", async () => {
    for (const data of ["{not json", JSON.stringify({ version: 2, entries: [["a", "A"]] }), JSON.stringify({ version: 1 }), ""]) {
      const cache = new TranslationCache(new MemoryStore(data));
      await cache.load();
      expect(cache.size).toBe(0);
    }
    const mixed = new TranslationCache(new MemoryStore(file([["a", "A"], ["b", 2], "c", ["d", "D"]])));
    await mixed.load();
    expect([mixed.size, mixed.get("a"), mixed.get("d")]).toEqual([2, "A", "D"]);
  });

  it("keeps only the newest entries when the file holds more than it may", async () => {
    const cache = new TranslationCache(new MemoryStore(file([["a", "A"], ["b", "B"], ["c", "C"]])), 2);
    await cache.load();
    expect([cache.get("a"), cache.get("b"), cache.get("c")]).toEqual([undefined, "B", "C"]);
  });

  it("tries again after a failed write", async () => {
    const store = new MemoryStore();
    const cache = new TranslationCache(store);
    store.failNextWrite = true;
    cache.set("a", "A");
    await cache.flush();
    expect(store.data).toBeUndefined();
    await cache.flush();
    expect(store.writes).toBe(2);
    expect(JSON.parse(store.data!)).toEqual({ version: 1, entries: [["a", "A"]] });
  });

  it("writes only when something changed", async () => {
    const store = new MemoryStore();
    const cache = new TranslationCache(store);
    cache.delete(["missing"]);
    await cache.flush();
    expect(store.writes).toBe(0);
    cache.set("a", "A");
    cache.delete(["a"]);
    await cache.flush();
    expect(store.writes).toBe(1);
    expect(JSON.parse(store.data!)).toEqual({ version: 1, entries: [] });
  });
});
