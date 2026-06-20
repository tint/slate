import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { checkFiles } from "../src/index";

const root = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(root, "../fixtures");

for (const fixtureName of readdirSync(fixturesDir).sort()) {
  const fixtureDir = join(fixturesDir, fixtureName);
  const entry = join(fixtureDir, "entry.slate");
  const outputPath = join(fixtureDir, "diagnostics.json");
  const result = await checkFiles({
    entry,
  });
  const diagnostics = result.diagnostics.map((diagnostic) => ({
    ...diagnostic,
    filename: diagnostic.filename ? relative(fixtureDir, diagnostic.filename) : undefined,
  }));

  mkdirSync(fixtureDir, {
    recursive: true,
  });
  writeFileSync(outputPath, `${JSON.stringify(diagnostics, null, 2)}\n`);
}
