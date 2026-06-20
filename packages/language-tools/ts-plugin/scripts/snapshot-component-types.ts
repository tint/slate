import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSlateModuleSource } from "../src/index";

const root = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(root, "../fixtures");

for (const fixtureName of readdirSync(fixturesDir).sort()) {
  const fixtureDir = join(fixturesDir, fixtureName);
  const output: Record<string, string> = {};

  for (const filename of readdirSync(fixtureDir).sort()) {
    if (!filename.endsWith(".slate")) {
      continue;
    }

    const path = join(fixtureDir, filename);
    output[`${filename}.module.ts`] = createSlateModuleSource(readFileSync(path, "utf8"), path);
  }

  if (Object.keys(output).length === 0) {
    continue;
  }

  mkdirSync(fixtureDir, {
    recursive: true,
  });
  writeFileSync(join(fixtureDir, "component-types.json"), `${JSON.stringify(output, null, 2)}\n`);
}
