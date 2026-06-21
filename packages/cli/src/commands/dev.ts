import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { createSlateDevServer } from "@slate/vite";
import { resolveInputs } from "../args.ts";
import { loadConfig } from "../config.ts";

export type DevOptions = {
  input?: string;
  config?: string;
  port?: number | string;
  host?: string;
  publicDir?: string;
  reload?: boolean;
  kit?: string;
};

export async function runDev(options: DevOptions = {}): Promise<void> {
  const config = await loadConfig(options.config, {
    command: "serve",
    mode: "development",
    phase: "dev",
  });
  const input = resolveInputs(options.input, config.input);
  const port = Number(options.port ?? process.env.PORT ?? config.dev.port);
  const host = options.host ?? config.dev.host;
  const publicDir = options.publicDir ?? config.publicDir;
  const reload = options.reload ?? config.dev.reload;
  const kitSpecifier = options.kit ?? config.kit.specifier;

  if (!input.length) {
    throw new Error("Missing input file. Usage: slate dev <input.slate> [--port 5173]");
  }

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${String(port)}`);
  }

  const server = await createSlateDevServer({
    root: process.cwd(),
    input: Object.fromEntries(input.map((item) => [item.name, item.path])),
    publicDir: publicDir ? resolve(publicDir) : undefined,
    reload,
    kitSpecifier,
    plugins: config.plugins,
    vite: config.vite,
    html: config.html,
    server: {
      host,
      port,
    },
  });

  await server.listen();
  const address = server.httpServer?.address() as AddressInfo;

  if (address && typeof address !== "string") {
    console.log(`Slate dev server running at http://${address.address}:${address.port}/`);
  }
}
