import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { createSlatePreviewServer } from "@slate/vite";
import { previewDirFromConfig } from "../args.ts";
import { loadConfig } from "../config.ts";

export type PreviewOptions = {
  config?: string;
  dir?: string;
  port?: number | string;
  host?: string;
};

export async function runPreview(options: PreviewOptions = {}): Promise<void> {
  const config = await loadConfig(options.config, {
    command: "serve",
    mode: "production",
    phase: "preview",
  });
  const port = Number(options.port ?? process.env.PORT ?? config.preview.port);
  const host = options.host ?? config.preview.host;
  const dir = options.dir ? resolve(options.dir) : resolve(previewDirFromConfig(config.build.output, config.input));

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${String(port)}`);
  }

  const server = createSlatePreviewServer({
    root: process.cwd(),
    dir,
  });

  server.listen(port, host, () => {
    const address = server.address() as AddressInfo;
    console.log(`Slate preview server running at http://${address.address}:${address.port}/`);
  });
}
