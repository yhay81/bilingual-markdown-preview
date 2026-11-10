// Bundles the extension host code (Node, CommonJS) and the preview webview script (browser, IIFE).
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
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
function writeThirdPartyNotices(metafiles, outfile, extraPackageDirs) {
  const packageDirs = new Set(extraPackageDirs.map((dir) => relative(process.cwd(), dir)));
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

const require = createRequire(import.meta.url);
/** The KaTeX that the Markdown plugin renders with, whose stylesheet and fonts must match its output. */
const katexDir = dirname(dirname(require.resolve("katex", { paths: [dirname(require.resolve("@vscode/markdown-it-katex"))] })));
const mermaidDir = dirname(dirname(require.resolve("mermaid")));

/**
 * Files the webview loads as they are: KaTeX's stylesheet with only its WOFF2 fonts, and Mermaid's
 * own browser bundle, which the webview loads only for documents with a diagram.
 */
function copyWebviewAssets() {
  mkdirSync("dist/katex/fonts", { recursive: true });
  const css = readFileSync(join(katexDir, "dist", "katex.min.css"), "utf8").replace(
    /,url\(fonts\/[^)]+\.woff\) format\("woff"\),url\(fonts\/[^)]+\.ttf\) format\("truetype"\)/g,
    "",
  );
  writeFileSync("dist/katex/katex.min.css", css);
  for (const name of readdirSync(join(katexDir, "dist", "fonts")).filter((file) => file.endsWith(".woff2"))) {
    copyFileSync(join(katexDir, "dist", "fonts", name), join("dist/katex/fonts", name));
  }
  mkdirSync("dist/webview", { recursive: true });
  copyFileSync(join(mermaidDir, "dist", "mermaid.min.js"), "dist/webview/mermaid.js");
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

copyWebviewAssets();
if (watch) {
  await Promise.all(contexts.map((context) => context.watch()));
} else {
  try {
    const results = await Promise.all(contexts.map((context) => context.rebuild()));
    if (production) {
      writeThirdPartyNotices(results.map((result) => result.metafile), "dist/ThirdPartyNotices.txt", [katexDir, mermaidDir]);
    }
  } finally {
    await Promise.all(contexts.map((context) => context.dispose()));
  }
}
