#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { run } from "./commands.ts";

export { runBuild } from "./commands/build.ts";
export type { BuildOptions } from "./commands/build.ts";
export { runCheck } from "./commands/check.ts";
export type { CheckOptions } from "./commands/check.ts";
export { runDev } from "./commands/dev.ts";
export type { DevOptions } from "./commands/dev.ts";
export { runPreview } from "./commands/preview.ts";
export type { PreviewOptions } from "./commands/preview.ts";
export { runInit } from "./scaffold.ts";
export { run } from "./commands.ts";
export type { InitOptions } from "./scaffold.ts";
export { defineConfig } from "./config.ts";
export type {
  ResolvedSlateConfig,
  ResolvedSlateInput,
  SlateConfig,
  SlateConfigCommand,
  SlateConfigContext,
  SlateConfigExport,
  SlateConfigMode,
  SlateConfigPhase,
} from "./config.ts";

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await run();
}
