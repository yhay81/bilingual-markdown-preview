// Bundles the extension host code (Node, CommonJS) and the preview webview script (browser, IIFE).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as esbuild from "esbuild";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** @type {import("esbuild").BuildOptions} */
const common = {
  bundle: true,
  minify: production,
  sourcemap: production ? false : "linked",
  logLevel: "info",
  legalComments: production ? "none" : "inline",
  metafile: production,
};

/**
 * The production bundles drop license comments, so the license of every npm package that ends up
 * in them is collected into one file that ships with the extension.
 * @param {import("esbuild").Metafile[]} metafiles
 */
function writeThirdPartyNotices(metafiles, outfile) {
  const packageDirs = new Set();
  for (const metafile of metafiles) {
    for (const input of Object.keys(metafile.inputs)) {
      // The last node_modules segment names the package, also for nested installs.
      const match = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(input);
      if (match) packageDirs.add(match[1]);
    }
  }
  const notices = [...packageDirs]
    .map((dir) => {
      const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      const license = typeof manifest.license === "string" ? manifest.license : (manifest.license?.type ?? "UNKNOWN");
      const files = readdirSync(dir)
        .filter((name) => /^(?:licen[cs]e|copying|notice)(?:[.-].*)?$/i.test(name))
        .sort();
      const texts = files.map((name) => readFileSync(join(dir, name), "utf8").trim());
      if (texts.length === 0) {
        const source = manifest.repository?.url ?? manifest.repository ?? manifest.homepage ?? "its npm page";
        texts.push(`The package ships no license file. It is licensed under ${license}; see ${source}.`);
      }
      return { title: `${manifest.name}@${manifest.version} (${license})`, texts };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
  const header = "This extension bundles the following third-party packages.\n";
  const body = notices.map(({ title, texts }) => `${"=".repeat(78)}\n${title}\n${"=".repeat(78)}\n\n${texts.join("\n\n")}\n`);
  writeFileSync(outfile, [header, ...body].join("\n"));
  console.log(`${outfile}: ${notices.map(({ title }) => title).join(", ")}`);
}

const contexts = await Promise.all([
  esbuild.context({
    ...common,
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.js",
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["vscode"],
  }),
  esbuild.context({
    ...common,
    entryPoints: ["src/webview/main.ts"],
    outfile: "dist/webview/main.js",
    platform: "browser",
    format: "iife",
    target: "es2022",
  }),
]);

if (watch) {
  await Promise.all(contexts.map((context) => context.watch()));
} else {
  try {
    const results = await Promise.all(contexts.map((context) => context.rebuild()));
    if (production) writeThirdPartyNotices(results.map((result) => result.metafile), "dist/ThirdPartyNotices.txt");
  } finally {
    await Promise.all(contexts.map((context) => context.dispose()));
  }
}
