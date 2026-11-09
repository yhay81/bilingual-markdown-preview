import { describe, expect, it } from "vitest";
import { SegStreamParser } from "../src/translate/segProtocol";

function parse(chunks: string[], acceptUnterminated = true): Array<[number, string]> {
  const out: Array<[number, string]> = [];
  const parser = new SegStreamParser((id, text) => out.push([id, text]));
  for (const chunk of chunks) parser.push(chunk);
  parser.finish(acceptUnterminated);
  return out;
}

describe("SegStreamParser", () => {
  it("emits segments split across arbitrary chunks and ignores text outside them", () => {
    const response = 'Sure!\n<seg id="1">こんにちは</seg>\n<seg id="2">世界 ⟦1⟧ <b></seg>';
    expect(parse([...response])).toEqual([
      [1, "こんにちは"],
      [2, "世界 ⟦1⟧ <b>"],
    ]);
  });

  it("emits each segment as soon as it closes", () => {
    const out: number[] = [];
    const parser = new SegStreamParser((id) => out.push(id));
    parser.push('<seg id="1">a</seg><seg id="2">b');
    expect(out).toEqual([1]);
    parser.push("</seg>");
    expect(out).toEqual([1, 2]);
  });

  it("accepts a segment whose closing tag is missing when the next one starts", () => {
    expect(parse(['<seg id="1">one\n<seg id="2">two</seg>'])).toEqual([
      [1, "one\n"],
      [2, "two"],
    ]);
  });

  it("accepts an unterminated final segment only when the response completed", () => {
    expect(parse(['<seg id="1">one</seg><seg id="2">two\n'], true)).toEqual([
      [1, "one"],
      [2, "two"],
    ]);
    expect(parse(['<seg id="1">one</seg><seg id="2">tw'], false)).toEqual([[1, "one"]]);
  });

  it("tolerates attribute quoting and case variations", () => {
    expect(parse(["<seg id=3>a</seg><SEG ID='4' >b</SEG >"])).toEqual([
      [3, "a"],
      [4, "b"],
    ]);
  });
});
