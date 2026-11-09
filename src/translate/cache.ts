/** Where the cache is persisted. The extension uses a file in global storage; tests use memory. */
export interface CacheStore {
  read(): Promise<string | undefined>;
  write(data: string): Promise<void>;
}

interface CacheFile {
  version: 1;
  entries: Array<[string, string]>;
}

/** Least-recently-used map of translation key → translated inline Markdown, saved in the background. */
export class TranslationCache {
  private readonly entries = new Map<string, string>();
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private readonly store?: CacheStore,
    private readonly maxEntries = 20_000,
    private readonly saveDelayMs = 2_000,
  ) {}

  async load(): Promise<void> {
    if (!this.store) return;
    try {
      const raw = await this.store.read();
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<CacheFile>;
      if (data.version !== 1 || !Array.isArray(data.entries)) return;
      for (const entry of data.entries) {
        if (Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "string") {
          this.entries.set(entry[0], entry[1]);
        }
      }
      this.evict();
    } catch {
      // A corrupt cache only costs retranslation; start empty.
    }
  }

  get size(): number {
    return this.entries.size;
  }

  get(key: string): string | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: string, value: string): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    this.evict();
    this.markDirty();
  }

  delete(keys: Iterable<string>): void {
    let changed = false;
    for (const key of keys) changed = this.entries.delete(key) || changed;
    if (changed) this.markDirty();
  }

  clear(): void {
    this.entries.clear();
    this.markDirty();
  }

  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
    }
    const store = this.store;
    if (!this.dirty || !store) return this.writing;
    this.dirty = false;
    const payload = JSON.stringify({ version: 1, entries: [...this.entries] } satisfies CacheFile);
    this.writing = this.writing
      .then(() => store.write(payload))
      .catch(() => {
        this.dirty = true;
      });
    return this.writing;
  }

  private markDirty(): void {
    this.dirty = true;
    if (!this.store || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      void this.flush();
    }, this.saveDelayMs);
  }

  private evict(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) return;
      this.entries.delete(oldest.value);
    }
  }
}
