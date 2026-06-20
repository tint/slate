#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { run } from "./commands";

export { runBuild } from "./commands/build";
export type { BuildOptions } from "./commands/build";
export { runCheck } from "./commands/check";
export type { CheckOptions } from "./commands/check";
export { runDev } from "./commands/dev";
export type { DevOptions } from "./commands/dev";
export { runPreview } from "./commands/preview";
export type { PreviewOptions } from "./commands/preview";
export { runInit } from "./scaffold";
export { run } from "./commands";
export type { InitOptions } from "./scaffold";
export { defineConfig } from "./config";
export type { ResolvedSlateConfig, ResolvedSlateInput, SlateConfig } from "./config";

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await run();
}
