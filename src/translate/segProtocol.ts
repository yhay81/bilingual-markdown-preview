const START_RE = /<seg\s+id\s*=\s*["']?(\d+)["']?\s*>/i;
const CLOSE_RE = /<\/seg\s*>/i;
const NEXT_START_RE = /<seg\s+id\s*=/i;

/**
 * Incrementally extracts `<seg id="N">…</seg>` blocks from a streamed model response,
 * so each segment can be shown as soon as it is complete. Text outside segments is ignored.
 */
export class SegStreamParser {
  private buffer = "";

  constructor(private readonly onSegment: (id: number, text: string) => void) {}

  push(chunk: string): void {
    this.buffer += chunk;
    this.drain();
  }

  /**
   * Flushes the stream. When the response ended normally, a final segment whose closing tag
   * is missing is still accepted; when it was cut off, that segment is dropped.
   */
  finish(acceptUnterminated: boolean): void {
    this.drain();
    if (acceptUnterminated) {
      const start = START_RE.exec(this.buffer);
      if (start) this.onSegment(Number(start[1]), this.buffer.slice(start.index + start[0].length).trimEnd());
    }
    this.buffer = "";
  }

  private drain(): void {
    for (;;) {
      const start = START_RE.exec(this.buffer);
      if (!start) {
        // Keep a possible partial start tag for the next chunk.
        const lastTag = this.buffer.lastIndexOf("<");
        this.buffer = lastTag >= 0 ? this.buffer.slice(lastTag) : "";
        return;
      }
      const id = Number(start[1]);
      const rest = this.buffer.slice(start.index + start[0].length);
      const close = CLOSE_RE.exec(rest);
      const next = NEXT_START_RE.exec(rest);
      if (close && (!next || close.index < next.index)) {
        this.onSegment(id, rest.slice(0, close.index));
        this.buffer = rest.slice(close.index + close[0].length);
        continue;
      }
      if (next) {
        // The model forgot a closing tag; the next segment starts here.
        this.onSegment(id, rest.slice(0, next.index));
        this.buffer = rest.slice(next.index);
        continue;
      }
      this.buffer = this.buffer.slice(start.index);
      return;
    }
  }
}
