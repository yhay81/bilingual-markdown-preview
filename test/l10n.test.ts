import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const readJson = (path: string): Record<string, string> => JSON.parse(readFileSync(join(root, path), "utf8"));
const placeholders = (text: string): string[] => (text.match(/\{\d+\}/g) ?? []).sort();

const english = readJson("package.nls.json");
const manifestLocales = readdirSync(root).filter((name) => /^package\.nls\.[a-z-]+\.json$/.test(name));
const bundles = readdirSync(join(root, "l10n")).filter((name) => /^bundle\.l10n\.[a-z-]+\.json$/.test(name));

/** The strings the extension passes to `vscode.l10n.t`, written as one literal. */
function sourceStrings(dir: string): string[] {
  const strings: string[] = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
    const text = readFileSync(join(entry.parentPath, entry.name), "utf8");
    for (const match of text.matchAll(/l10n\.t\(\s*("(?:[^"\\]|\\.)*")\s*[,)]/g)) strings.push(JSON.parse(match[1] ?? '""'));
  }
  return strings;
}

describe("localization", () => {
  it("has the same languages for the manifest and the runtime strings", () => {
    const languages = (names: string[]) => names.map((name) => name.split(".").at(-2)).sort();
    expect(languages(manifestLocales)).toEqual(languages(bundles));
  });

  it("names every manifest string in package.nls.json", () => {
    const manifest = readFileSync(join(root, "package.json"), "utf8");
    const keys = [...manifest.matchAll(/"%([^%"]+)%"/g)].map((match) => match[1] ?? "");
    expect(keys.filter((key) => !(key in english))).toEqual([]);
  });

  it.each(manifestLocales)("translates every manifest string in %s", (name) => {
    const translated = readJson(name);
    expect(Object.keys(translated)).toEqual(Object.keys(english));
    for (const [key, text] of Object.entries(english)) expect(placeholders(translated[key] ?? ""), key).toEqual(placeholders(text));
  });

  it.each(bundles)("translates every runtime string in %s", (name) => {
    const translated = readJson(join("l10n", name));
    const strings = sourceStrings("src");
    expect(strings.length).toBeGreaterThan(50);
    const missing = strings.filter((text) => !(text in translated));
    expect(missing).toEqual([]);
    for (const [text, translation] of Object.entries(translated)) expect(placeholders(translation), text).toEqual(placeholders(text));
  });

  it("has the same runtime strings in every language", () => {
    const keySets = bundles.map((name) => Object.keys(readJson(join("l10n", name))).sort());
    for (const keys of keySets) expect(keys).toEqual(keySets[0]);
  });
});
