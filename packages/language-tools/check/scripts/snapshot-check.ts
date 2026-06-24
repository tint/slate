import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { checkFiles } from "../src/index";

const root = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(root, "../fixtures");

for (const fixtureName of readdirSync(fixturesDir).sort()) {
  const fixtureDir = join(fixturesDir, fixtureName);
  const entry = join(fixtureDir, "entry.slate");
  const configPath = join(fixtureDir, "check.config.json");
  const outputPath = join(fixtureDir, "diagnostics.json");
  const config = existsSync(configPath)
    ? JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>
    : {};
  const result = await checkFiles({
    entry,
    attributeDiagnostics: Array.isArray(config.attributeDiagnostics) ? config.attributeDiagnostics : undefined,
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
