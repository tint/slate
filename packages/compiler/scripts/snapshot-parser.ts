import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "../src/index";

const root = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(root, "../fixtures/parser");

for (const fixtureName of readdirSync(fixturesDir)) {
  const fixtureDir = join(fixturesDir, fixtureName);
  const inputPath = join(fixtureDir, "input.slate");
  const outputPath = join(fixtureDir, "output.json");
  const diagnosticsPath = join(fixtureDir, "diagnostics.json");
  const source = readFileSync(inputPath, "utf8");
  const result = parse(source, {
    filename: inputPath,
  });

  mkdirSync(fixtureDir, {
    recursive: true,
  });
  writeFileSync(outputPath, `${JSON.stringify(result.cst, null, 2)}\n`);
  writeFileSync(diagnosticsPath, `${JSON.stringify(result.diagnostics, null, 2)}\n`);
}
