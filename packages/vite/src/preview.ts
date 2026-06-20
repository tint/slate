import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import { resolve } from "node:path";
import { previewErrorPage, sendHtml } from "./errors";
import { servePreviewFile } from "./public-files";
import type { SlatePreviewOptions } from "./types";

/** Create a small static server for already-built Slate output. */
export function createSlatePreviewServer(options: SlatePreviewOptions = {}): HttpServer {
  const root = resolve(options.root ?? process.cwd());
  const dir = resolve(root, options.dir ?? "dist");

  return createHttpServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendHtml(response, 405, previewErrorPage("Method not allowed", `${request.method ?? "UNKNOWN"} is not supported.`), request.method === "HEAD");
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const result = await servePreviewFile(dir, decodeURIComponent(url.pathname));

    if (!result) {
      sendHtml(response, 404, previewErrorPage("Not found", `No built file for ${url.pathname}`), request.method === "HEAD");
      return;
    }

    response.writeHead(result.status, result.headers);

    if (request.method === "HEAD") {
      response.end();
    } else {
      response.end(result.body);
    }
  });
}
