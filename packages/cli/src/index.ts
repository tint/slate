#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

export type { BuildOptions } from "./commands/build.ts";
export type { CheckOptions } from "./commands/check.ts";
export type { DevOptions } from "./commands/dev.ts";
export type { PreviewOptions } from "./commands/preview.ts";
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

import type { BuildOptions } from "./commands/build.ts";
import type { CheckOptions } from "./commands/check.ts";
import type { DevOptions } from "./commands/dev.ts";
import type { PreviewOptions } from "./commands/preview.ts";
import type { SlateConfigExport } from "./config.ts";

export function defineConfig(config: SlateConfigExport): SlateConfigExport {
  return config;
}

export async function runBuild(options: BuildOptions): Promise<void> {
  await loadTsx();
  const { runBuild } = await import("./commands/build.ts");
  return runBuild(options);
}

export async function runCheck(options: CheckOptions): Promise<void> {
  await loadTsx();
  const { runCheck } = await import("./commands/check.ts");
  return runCheck(options);
}

export async function runDev(options: DevOptions): Promise<void> {
  await loadTsx();
  const { runDev } = await import("./commands/dev.ts");
  return runDev(options);
}

export async function runPreview(options: PreviewOptions): Promise<void> {
  await loadTsx();
  const { runPreview } = await import("./commands/preview.ts");
  return runPreview(options);
}

export async function run(argv: string[] = process.argv.slice(2)): Promise<void> {
  await loadTsx();
  const { run } = await import("./commands.ts");
  return run(argv);
}

if (isCliEntryPoint()) {
  await run();
}

async function loadTsx(): Promise<void> {
  if ("Bun" in globalThis) {
    return;
  }

  await import("tsx");
}

function isCliEntryPoint(): boolean {
  const entry = process.argv[1];

  if (!entry) {
    return false;
  }

  if (import.meta.url === pathToFileURL(entry).href) {
    return true;
  }

  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}
