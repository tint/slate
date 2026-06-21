import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { InlineConfig, ViteDevServer } from "vite";
import { createServer as createViteServer, mergeConfig } from "vite";
import { cloneContext, injectCollectedAssets } from "@slate/kit";
import { normalizeInputs, normalizeUserViteConfig, routeForPath } from "./config";
import { collectSlateCssImports, cssImportDevUrls, injectStylesheets } from "./css-imports";
import { errorPage, injectViteClient, stripViteClient } from "./errors";
import { slate } from "./plugin";
import type { SlateViteOptions } from "./types";

/** Create a Vite dev server that renders configured Slate inputs on request. */
export async function createSlateDevServer(options: SlateViteOptions): Promise<ViteDevServer> {
  const root = resolve(options.root ?? process.cwd());
  const inputs = normalizeInputs(root, options.input);
  const server = await createViteServer(mergeConfig(normalizeUserViteConfig(options.vite), {
    root,
    configFile: false,
    appType: "custom",
    publicDir: options.publicDir ?? "public",
    plugins: [...(options.plugins ?? []), slate({
      kitSpecifier: options.kitSpecifier,
    })],
    server: {
      host: options.server?.host ?? "127.0.0.1",
      port: options.server?.port ?? 5173,
    },
  } satisfies InlineConfig));

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
      const mod = await server.ssrLoadModule(input.path);
      const context = cloneContext();
      const html = injectCollectedAssets(await mod.render({}, {}, context), context);
      const stylesheetUrls = cssImportDevUrls(root, input.path, collectSlateCssImports(await readFile(input.path, "utf8")));
      const transformedHtml = await server.transformIndexHtml(url.pathname, injectStylesheets(String(html), stylesheetUrls));
      const body = options.reload === false ? stripViteClient(transformedHtml) : injectViteClient(transformedHtml);
      response.statusCode = 200;
      response.setHeader("content-type", "text/html; charset=utf-8");

      if (request.method === "HEAD") {
        response.end();
      } else {
        response.end(body);
      }
    } catch (error) {
      server.ssrFixStacktrace(error as Error);
      response.statusCode = 500;
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(errorPage(error instanceof Error ? error.stack ?? error.message : String(error)));
    }
  });

  return server;
}
