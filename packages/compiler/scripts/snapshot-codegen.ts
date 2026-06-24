import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "../src/index";

const root = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(root, "../fixtures/codegen");

for (const fixtureName of readdirSync(fixturesDir)) {
  const fixtureDir = join(fixturesDir, fixtureName);
  const inputPath = join(fixtureDir, "input.slate");
  const outputPath = join(fixtureDir, "output.js");
  const mapPath = join(fixtureDir, "output.map.json");
  const diagnosticsPath = join(fixtureDir, "diagnostics.json");
  const source = readFileSync(inputPath, "utf8");
  const result = compile(
    source,
    fixtureName === "sourcemap"
      ? {
          filename: "input.slate",
          sourcemap: true,
        }
      : fixtureName === "debug-dev"
        ? {
            dev: true,
          }
      : {},
  );

  mkdirSync(fixtureDir, {
    recursive: true,
  });
  writeFileSync(outputPath, result.code);
  if (result.map) {
    writeFileSync(mapPath, `${JSON.stringify(result.map, null, 2)}\n`);
  }
  writeFileSync(diagnosticsPath, `${JSON.stringify(result.diagnostics, null, 2)}\n`);
}
