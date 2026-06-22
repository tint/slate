import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import type { InlineConfig } from "vite";
import { build as viteBuild, mergeConfig } from "vite";
import { normalizeUserViteConfig } from "./config.ts";
import { slate } from "./plugin.ts";
import type { SlatePlugin, SlateViteUserConfig } from "./types.ts";

type CssImport = {
  specifier: string;
};

type ViteManifestEntry = {
  file?: string;
  css?: string[];
};

/** Extract side-effect CSS imports from `<script slate>`. */
export function collectSlateCssImports(source: string): CssImport[] {
  const imports: CssImport[] = [];
  const scriptRegex = /<script\b(?=[^>]*\bslate\b)[^>]*>([\s\S]*?)<\/script>/gi;

  for (const scriptMatch of source.matchAll(scriptRegex)) {
    const body = scriptMatch[1] ?? "";
    const importRegex = /^\s*import\s+["']([^"']+\.css(?:[?#][^"']*)?)["']\s*;?\s*$/gm;

    for (const importMatch of body.matchAll(importRegex)) {
      const specifier = importMatch[1];

      if (specifier) {
        imports.push({
          specifier,
        });
      }
    }
  }

  return dedupeCssImports(imports);
}

/** Convert CSS imports to dev-server URLs that Vite can transform. */
export function cssImportDevUrls(root: string, inputPath: string, imports: CssImport[]): string[] {
  return imports.map((cssImport) => cssImportToDevUrl(root, inputPath, cssImport.specifier));
}

/** Build imported CSS through Vite and return output hrefs relative to the HTML file. */
export async function buildSlateCssImports(options: {
  root: string;
  inputPath: string;
  tmpDir: string;
  outDir: string;
  imports: CssImport[];
  plugins: SlatePlugin[];
  vite?: SlateViteUserConfig;
  kitSpecifier: string;
}): Promise<string[]> {
  if (!options.imports.length) {
    return [];
  }

  const entryPath = resolve(options.tmpDir, "slate-css-entry.mjs");
  const manifestPath = resolve(options.outDir, ".vite/slate-css-manifest.json");
  const entrySource = options.imports
    .map((cssImport) => `import ${JSON.stringify(cssImportToImportPath(options.root, options.inputPath, entryPath, cssImport.specifier))};`)
    .join("\n");

  await mkdir(options.tmpDir, {
    recursive: true,
  });
  await writeFile(entryPath, `${entrySource}\n`, "utf8");

  await viteBuild(mergeConfig(normalizeUserViteConfig(options.vite), {
    root: options.root,
    configFile: false,
    logLevel: "silent",
    publicDir: false,
    plugins: [...options.plugins, slate({
      kitSpecifier: options.kitSpecifier,
    })],
    build: {
      outDir: options.outDir,
      emptyOutDir: false,
      copyPublicDir: false,
      manifest: ".vite/slate-css-manifest.json",
      rollupOptions: {
        input: entryPath,
        output: {
          assetFileNames: "assets/[name]-[hash][extname]",
          chunkFileNames: "assets/[name]-[hash].js",
          entryFileNames: "assets/[name]-[hash].js",
        },
      },
    },
  } satisfies InlineConfig));

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, ViteManifestEntry>;
  const entries = Object.values(manifest);
  const cssFiles = entries.flatMap((entry) => entry.css ?? []);

  for (const entry of entries) {
    if (entry.file?.endsWith(".js")) {
      await rm(resolve(options.outDir, entry.file), {
        force: true,
      });
    }
  }

  return Array.from(new Set(cssFiles));
}

/** Inject stylesheet links into HTML, preferring the existing `<head>`. */
export function injectStylesheets(html: string, hrefs: string[]): string {
  const uniqueHrefs = Array.from(new Set(hrefs)).filter(Boolean);

  if (!uniqueHrefs.length) {
    return html;
  }

  const links = uniqueHrefs
    .map((href) => `<link rel="stylesheet" href="${escapeAttribute(href)}">`)
    .join("\n");

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${links}\n</head>`);
  }

  return `${links}\n${html}`;
}

function cssImportToDevUrl(root: string, inputPath: string, specifier: string): string {
  if (specifier.startsWith("/")) {
    return specifier;
  }

  const { path, suffix } = splitSpecifierSuffix(specifier);
  const absolutePath = path.startsWith(".") ? resolve(dirname(inputPath), path) : resolve(root, path);
  const urlPath = relative(root, absolutePath).replaceAll("\\", "/");

  return `/${urlPath}${suffix}`;
}

function cssImportToImportPath(root: string, inputPath: string, entryPath: string, specifier: string): string {
  if (specifier.startsWith("/") || specifier.startsWith(".")) {
    const { path, suffix } = splitSpecifierSuffix(specifier);
    const absolutePath = specifier.startsWith("/") ? resolve(root, `.${path}`) : resolve(dirname(inputPath), path);
    let relativePath = relative(dirname(entryPath), absolutePath).replaceAll("\\", "/");

    if (!relativePath.startsWith(".")) {
      relativePath = `./${relativePath}`;
    }

    return `${relativePath}${suffix}`;
  }

  return specifier;
}

function splitSpecifierSuffix(specifier: string): { path: string; suffix: string } {
  const match = specifier.match(/^([^?#]*)([?#].*)?$/);

  return {
    path: match?.[1] ?? specifier,
    suffix: match?.[2] ?? "",
  };
}

function dedupeCssImports(imports: CssImport[]): CssImport[] {
  const seen = new Set<string>();
  const result: CssImport[] = [];

  for (const cssImport of imports) {
    if (seen.has(cssImport.specifier)) {
      continue;
    }

    seen.add(cssImport.specifier);
    result.push(cssImport);
  }

  return result;
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
