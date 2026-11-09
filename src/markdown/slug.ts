const STRIP_RE = /[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu;

/** GitHub-style heading anchors, so `[link](#getting-started)` works as it does on GitHub. */
export class Slugger {
  private readonly seen = new Map<string, number>();

  slug(text: string): string {
    const base = text.trim().toLowerCase().replace(STRIP_RE, "").replace(/ /g, "-");
    let count = this.seen.get(base);
    if (count === undefined) {
      this.seen.set(base, 0);
      return base;
    }
    let slug: string;
    do {
      count++;
      slug = `${base}-${count}`;
    } while (this.seen.has(slug));
    this.seen.set(base, count);
    this.seen.set(slug, 0);
    return slug;
  }
}
