import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { compile } from "../src/index";

const root = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(root, "../fixtures/render");
const tmpDir = join(root, "../.tmp/render-fixtures");
const kitPath = pathToFileURL(join(root, "../../kit/src/index.ts")).href;
let failed = false;

rmSync(tmpDir, {
  recursive: true,
  force: true,
});
mkdirSync(tmpDir, {
  recursive: true,
});

for (const fixtureName of readdirSync(fixturesDir)) {
  const fixtureDir = join(fixturesDir, fixtureName);
  const inputPath = join(fixtureDir, "input.slate");
  const expectedPath = join(fixtureDir, "expected.html");
  const expectedErrorPath = join(fixtureDir, "expected-error.json");
  const outputPath = join(fixtureDir, "actual.html");
  const fixtureTmpDir = join(tmpDir, fixtureName);
  const modulePath = join(fixtureTmpDir, "input.mjs");
  const source = readFileSync(inputPath, "utf8");
  const expected = existsSync(expectedPath) ? readFileSync(expectedPath, "utf8") : undefined;
  const expectedError = existsSync(expectedErrorPath)
    ? JSON.parse(readFileSync(expectedErrorPath, "utf8")) as {
        name?: string;
        messageIncludes?: string;
        filenameIncludes?: string;
        rangeText?: string;
        kind?: string;
        causeName?: string;
      }
    : undefined;
  const slateFiles = readdirSync(fixtureDir).filter((file) => file.endsWith(".slate"));

  mkdirSync(fixtureTmpDir, {
    recursive: true,
  });

  for (const file of slateFiles) {
    const filePath = join(fixtureDir, file);
    const result = compile(readFileSync(filePath, "utf8"), {
      filename: filePath,
    });

    if (result.diagnostics.length) {
      failed = true;
      console.error(`${fixtureName}/${file}: unexpected diagnostics`);
      console.error(JSON.stringify(result.diagnostics, null, 2));
      continue;
    }

    const outputModule = join(fixtureTmpDir, `${basename(file, ".slate")}.mjs`);
    writeFileSync(outputModule, rewriteImports(result.code, fixtureTmpDir));
  }

  const result = compile(source, {
    filename: inputPath,
  });

  if (result.diagnostics.length) {
    failed = true;
    console.error(`${fixtureName}: unexpected diagnostics`);
    console.error(JSON.stringify(result.diagnostics, null, 2));
    continue;
  }

  writeFileSync(modulePath, rewriteImports(result.code, fixtureTmpDir));

  try {
    const mod = await import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`);
    const actual = await mod.render();

    if (expectedError) {
      failed = true;
      console.error(`${fixtureName}: expected render error, got success`);
      continue;
    }

    writeFileSync(outputPath, actual);

    if (actual !== expected) {
      failed = true;
      console.error(`${fixtureName}: output mismatch`);
      console.error("Expected:");
      console.error(JSON.stringify(expected));
      console.error("Actual:");
      console.error(JSON.stringify(actual));
    }
  } catch (cause) {
    if (!expectedError) {
      failed = true;
      console.error(`${fixtureName}: render failed`);
      console.error(cause);
      continue;
    }

    if (!matchesExpectedError(cause, expectedError, source)) {
      failed = true;
      console.error(`${fixtureName}: render error mismatch`);
      console.error(cause);
      console.error("Expected:");
      console.error(JSON.stringify(expectedError, null, 2));
    }
  }
}

if (failed) {
  process.exitCode = 1;
}

function rewriteImports(code: string, fixtureTmpDir: string): string {
  let output = code.replace("\"@slate/kit\"", JSON.stringify(kitPath));

  for (const file of readdirSync(fixtureTmpDir)) {
    if (!file.endsWith(".mjs")) {
      continue;
    }

    const slateSpecifier = `./${basename(file, ".mjs")}.slate`;
    output = output.replaceAll(JSON.stringify(slateSpecifier), JSON.stringify(`./${file}`));
  }

  return output;
}

function matchesExpectedError(
  cause: unknown,
  expected: {
    name?: string;
    messageIncludes?: string;
    filenameIncludes?: string;
    rangeText?: string;
    kind?: string;
    causeName?: string;
  },
  source: string,
): boolean {
  if (!(cause instanceof Error)) {
    return false;
  }

  const error = cause as Error & {
    filename?: string;
    range?: { start: number; end: number };
    kind?: string;
    cause?: unknown;
  };

  if (expected.name && error.name !== expected.name) {
    return false;
  }

  if (expected.messageIncludes && !error.message.includes(expected.messageIncludes)) {
    return false;
  }

  if (expected.filenameIncludes && !error.filename?.includes(expected.filenameIncludes)) {
    return false;
  }

  if (expected.kind && error.kind !== expected.kind) {
    return false;
  }

  if (expected.rangeText && (!error.range || source.slice(error.range.start, error.range.end) !== expected.rangeText)) {
    return false;
  }

  if (expected.causeName && (!(error.cause instanceof Error) || error.cause.name !== expected.causeName)) {
    return false;
  }

  return true;
}
