#!/usr/bin/env node

if (!("Bun" in globalThis)) {
  await import("tsx");
}

const { run } = await import("./index.ts");

await run();
