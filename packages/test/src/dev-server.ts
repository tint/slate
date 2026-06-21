import { createSlateDevServer, type SlateViteInput } from "@slate/vite";
import type { ViteDevServer } from "vite";

export type StartSlateDevServerOptions = {
  root?: string;
  input: SlateViteInput;
  publicDir?: string | false;
  host?: string;
  port?: number;
  reload?: boolean;
  preserveScroll?: boolean;
};

export type StartedSlateDevServer = {
  url: string;
  origin: string;
  host: string;
  port: number;
  server: ViteDevServer;
  close(): Promise<void>;
};

/**
 * Start a Slate dev server for browser-based tests.
 *
 * This helper is test-runner agnostic. It does not import Playwright, Vitest
 * browser mode, Cypress, or any browser automation package; it only returns a
 * URL and a close function that those tools can use.
 */
export async function startSlateDevServer(options: StartSlateDevServerOptions): Promise<StartedSlateDevServer> {
  const requestedHost = options.host ?? "127.0.0.1";
  const server = await createSlateDevServer({
    root: options.root,
    input: options.input,
    publicDir: options.publicDir,
    reload: options.reload,
    preserveScroll: options.preserveScroll,
    server: {
      host: requestedHost,
      port: options.port ?? 0,
    },
  });

  await server.listen();

  const address = server.httpServer?.address();

  if (!address || typeof address === "string") {
    await server.close();
    throw new Error("Slate dev server did not expose a TCP address.");
  }

  const host = normalizeHostForUrl(address.address, requestedHost);
  const port = address.port;
  const origin = `http://${host}:${port}`;

  return {
    url: `${origin}/`,
    origin,
    host,
    port,
    server,
    close: () => server.close(),
  };
}

function normalizeHostForUrl(address: string, requestedHost: string): string {
  if (address === "::" || address === "0.0.0.0") {
    return "127.0.0.1";
  }

  if (address === "::1") {
    return "[::1]";
  }

  if (address.includes(":")) {
    return `[${address}]`;
  }

  return requestedHost === "0.0.0.0" ? "127.0.0.1" : address;
}
