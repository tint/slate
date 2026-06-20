#!/usr/bin/env node
import { a as runCheck, i as runDev, n as runPreview, o as runBuild, r as runInit, t as run } from "./commands-3xBcrd4t.mjs";
import { t as defineConfig } from "./config-CgeRExtq.mjs";
import { pathToFileURL } from "node:url";
//#region src/index.ts
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await run();
//#endregion
export { defineConfig, run, runBuild, runCheck, runDev, runInit, runPreview };
