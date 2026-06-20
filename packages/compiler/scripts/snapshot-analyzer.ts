import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, parse } from "../src/index";

const root = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(root, "../fixtures/analyzer");

for (const fixtureName of readdirSync(fixturesDir)) {
  const fixtureDir = join(fixturesDir, fixtureName);
  const inputPath = join(fixtureDir, "input.slate");
  const outputPath = join(fixtureDir, "output.json");
  const diagnosticsPath = join(fixtureDir, "diagnostics.json");
  const source = readFileSync(inputPath, "utf8");
  const parsed = parse(source, {
    filename: inputPath,
  });
  const analyzed = analyze(parsed.cst, {
    filename: inputPath,
  });
  const diagnostics = [...parsed.diagnostics, ...analyzed.diagnostics];

  mkdirSync(fixtureDir, {
    recursive: true,
  });
  writeFileSync(outputPath, `${JSON.stringify(analyzed.module, null, 2)}\n`);
  writeFileSync(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`);
}
