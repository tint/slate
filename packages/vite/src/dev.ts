import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { InlineConfig, ViteDevServer } from "vite";
import { createServer as createViteServer, mergeConfig } from "vite";
import { cloneContext, injectCollectedAssets, renderHTML } from "@slate/kit";
import { normalizeInputs, normalizeUserViteConfig, routeForPath } from "./config.ts";
import { collectSlateCssImports, cssImportDevUrls, injectStylesheets } from "./css-imports.ts";
import { errorPage, injectViteClient, stripViteClient } from "./errors.ts";
import { processHtml } from "./html.ts";
import { slate } from "./plugin.ts";
import type { SlateViteOptions } from "./types.ts";

/** Create a Vite dev server that renders configured Slate inputs on request. */
export async function createSlateDevServer(options: SlateViteOptions): Promise<ViteDevServer> {
  const root = resolve(options.root ?? process.cwd());
  const inputs = normalizeInputs(root, options.input);
  const watchedCssFiles = new Set<string>();
  const server = await createViteServer(mergeConfig(normalizeUserViteConfig(options.vite), {
    root,
    configFile: false,
    appType: "custom",
    publicDir: options.publicDir ?? "public",
    plugins: [...(options.plugins ?? []), slate({
      kitSpecifier: options.kitSpecifier,
      dev: true,
    })],
    server: {
      host: options.server?.host ?? "127.0.0.1",
      port: options.server?.port ?? 5173,
    },
  } satisfies InlineConfig));

  const reloadWatchedCssImport = (file: string): void => {
    if (watchedCssFiles.has(resolve(file))) {
      server.ws.send({
        type: "full-reload",
        path: "*",
      });
    }
  };

  server.watcher.on("add", reloadWatchedCssImport);
  server.watcher.on("change", reloadWatchedCssImport);
  server.watcher.on("unlink", reloadWatchedCssImport);

  server.middlewares.use(async (request, response, next) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      next();
      return;
    }

    const url = new URL(request.url ?? "/", "http://localhost");
    const input = routeForPath(url.pathname, inputs);

    if (!input) {
      next();
      return;
    }

    try {
      const source = await readFile(input.path, "utf8");
      const cssImports = collectSlateCssImports(source);
      watchCssImports(root, input.path, cssImports, watchedCssFiles, server);
      const mod = await server.ssrLoadModule(input.path);
      const context = cloneContext();
      const html = injectCollectedAssets(await renderHTML(await mod.render({}, {}, context)), context);
      const stylesheetUrls = cssImportDevUrls(root, input.path, cssImports);
      const transformedHtml = await server.transformIndexHtml(url.pathname, injectStylesheets(String(html), stylesheetUrls));
      const htmlWithClient = options.reload === false
        ? stripViteClient(transformedHtml)
        : injectViteClient(transformedHtml, options.preserveScroll !== false);
      // Run HTML postprocess after Vite's transformIndexHtml and reload client
      // injection so dev responses match the final served document shape.
      const body = await processHtml(htmlWithClient, options.html);
      response.statusCode = 200;
      response.setHeader("content-type", "text/html; charset=utf-8");

      if (request.method === "HEAD") {
        response.end();
      } else {
        response.end(body);
      }
    } catch (error) {
      server.ssrFixStacktrace(error as Error);
      const page = errorPage(error instanceof Error ? error.stack ?? error.message : String(error));
      const htmlWithClient = options.reload === false
        ? page
        : injectViteClient(page, options.preserveScroll !== false);
      response.statusCode = 500;
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(htmlWithClient);
    }
  });

  return server;
}

function watchCssImports(
  root: string,
  inputPath: string,
  imports: ReturnType<typeof collectSlateCssImports>,
  watchedCssFiles: Set<string>,
  server: ViteDevServer,
): void {
  const files = cssImportFiles(root, inputPath, imports);
  const watchTargets = new Set<string>();

  for (const file of files) {
    if (watchedCssFiles.has(file)) {
      continue;
    }

    watchedCssFiles.add(file);
    watchTargets.add(file);
    watchTargets.add(dirname(file));
  }

  if (watchTargets.size) {
    server.watcher.add(Array.from(watchTargets));
  }
}

function cssImportFiles(root: string, inputPath: string, imports: ReturnType<typeof collectSlateCssImports>): string[] {
  const files: string[] = [];

  for (const cssImport of imports) {
    const specifier = cssImport.specifier.split(/[?#]/, 1)[0] ?? "";

    if (!specifier || isBareSpecifier(specifier)) {
      continue;
    }

    files.push(specifier.startsWith("/")
      ? resolve(root, specifier.slice(1))
      : resolve(dirname(inputPath), specifier));
  }

  return Array.from(new Set(files));
}

function isBareSpecifier(specifier: string): boolean {
  return !specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.match(/^[A-Za-z]:[\\/]/);
}
