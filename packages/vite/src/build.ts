import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { InlineConfig } from "vite";
import { build as viteBuild, mergeConfig } from "vite";
import { formatDiagnostic } from "@slate/compiler";
import { cloneContext, injectCollectedAssets, renderHTML } from "@slate/kit";
import { normalizeInputs, normalizeUserViteConfig } from "./config.ts";
import { buildSlateCssImports, collectSlateCssImports, injectStylesheets } from "./css-imports.ts";
import { isSlateRenderError } from "./errors.ts";
import { processHtml } from "./html.ts";
import { copyPublicDir } from "./public-files.ts";
import { slate } from "./plugin.ts";
import type { SlateBuildOptions, SlatePlugin, SlateViteUserConfig } from "./types.ts";

/**
 * Build one or more Slate inputs to static HTML.
 *
 * Each input is first bundled as a Vite SSR module, then imported and rendered
 * to HTML. This keeps production behavior aligned with Vite's transform and
 * resolve pipeline instead of using a separate compiler-only build path.
 */
export async function buildSlate(options: SlateBuildOptions): Promise<boolean> {
  const root = resolve(options.root ?? process.cwd());
  const inputs = normalizeInputs(root, options.input);
  const output = resolve(root, options.output ?? (inputs.length > 1 ? "dist" : "dist/index.html"));
  const tmpDir = resolve(root, options.tmpDir ?? "node_modules/.slate-tmp");
  const publicOutDir = inputs.length > 1 ? output : dirname(output);

  await rm(tmpDir, {
    recursive: true,
    force: true,
  });
  await mkdir(tmpDir, {
    recursive: true,
  });

  for (const input of inputs) {
    const outPath = inputs.length > 1 ? resolve(output, `${input.name}.html`) : output;
    const result = await renderBuildInput(root, input.path, resolve(tmpDir, input.name), publicOutDir, options.kitSpecifier ?? "@slate/kit", options.plugins ?? [], options.vite, options.html);

    if (!result.ok) {
      options.onError?.(result.message);
      return false;
    }

    await mkdir(dirname(outPath), {
      recursive: true,
    });
    await writeFile(outPath, result.html, "utf8");
    options.onBuilt?.(outPath);
  }

  if (options.publicDir) {
    await copyPublicDir(resolve(root, options.publicDir), publicOutDir);
  }

  return true;
}

async function renderBuildInput(root: string, inputPath: string, tmpDir: string, outDir: string, kitSpecifier: string, plugins: SlatePlugin[], vite?: SlateViteUserConfig, htmlOptions?: SlateBuildOptions["html"]): Promise<
  | { ok: true; html: string }
  | { ok: false; message: string }
> {
  try {
    await viteBuild(mergeConfig(normalizeUserViteConfig(vite), {
      root,
      configFile: false,
      logLevel: "silent",
      publicDir: false,
      plugins: [...plugins, slate({
        kitSpecifier,
        dev: false,
      })],
      build: {
        ssr: inputPath,
        outDir: tmpDir,
        sourcemap: vite?.build?.sourcemap,
        emptyOutDir: true,
        copyPublicDir: false,
        rollupOptions: {
          output: {
            entryFileNames: "entry.mjs",
            chunkFileNames: "chunks/[name]-[hash].mjs",
            format: "es",
          },
        },
      },
    } satisfies InlineConfig));
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const source = await readFile(inputPath, "utf8");
  const cssImports = collectSlateCssImports(source);
  const stylesheetHrefs = await buildSlateCssImports({
    root,
    inputPath,
    tmpDir: resolve(tmpDir, "css"),
    outDir,
    imports: cssImports,
    plugins,
    vite,
    kitSpecifier,
  });

  // Import the freshly-built SSR entry with a cache-busting query so repeated
  // builds in the same process do not reuse stale modules.
  const mod = await import(`${pathToFileURL(resolve(tmpDir, "entry.mjs")).href}?t=${Date.now()}`);

  try {
    const context = cloneContext();
    const html = injectCollectedAssets(await renderHTML(await mod.render({}, {}, context)), context);
    const htmlWithStylesheets = injectStylesheets(html, stylesheetHrefs);

    return {
      ok: true,
      // HTML postprocess is last so it sees the same document that will be
      // written to disk, including collected global assets and bundled CSS.
      html: await processHtml(htmlWithStylesheets, htmlOptions),
    };
  } catch (error) {
    if (isSlateRenderError(error)) {
      return {
        ok: false,
        message: formatDiagnostic(
          {
            message: error.message,
            severity: "error",
            range: error.range,
            filename: error.filename,
          },
          await sourceForDiagnostic(error.filename),
        ),
      };
    }

    throw error;
  }
}

async function sourceForDiagnostic(filename: string): Promise<string | undefined> {
  try {
    return await readFile(filename, "utf8");
  } catch {
    return undefined;
  }
}
