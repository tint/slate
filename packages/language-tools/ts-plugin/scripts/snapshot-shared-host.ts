import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  createSlateCompilerHost,
  createSlateLanguageServiceHost,
  createSlateVirtualDocument,
  SLATE_TYPE_SCRIPT_COMPILER_OPTIONS,
  toOriginalOffset,
  type SlateVirtualDocument,
} from "../src/index";

const root = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(root, "../fixtures");

for (const fixtureName of readdirSync(fixturesDir).sort()) {
  const fixtureDir = join(fixturesDir, fixtureName);
  const entryPath = join(fixtureDir, "entry.slate");

  if (!existsSync(entryPath)) {
    continue;
  }

  const sources = readSlateSources(fixtureDir);
  const entrySource = sources.get(entryPath) ?? "";
  const virtualDocument = createSlateVirtualDocument(entrySource, entryPath);
  const output = {
    languageService: runLanguageServiceHost(fixtureDir, virtualDocument, sources),
    compiler: runCompilerHost(fixtureDir, virtualDocument, sources),
  };

  mkdirSync(fixtureDir, {
    recursive: true,
  });
  writeFileSync(join(fixtureDir, "shared-host.json"), `${JSON.stringify(output, null, 2)}\n`);
}

function runLanguageServiceHost(
  fixtureDir: string,
  virtualDocument: SlateVirtualDocument,
  sources: Map<string, string>,
): unknown[] {
  const host = createSlateLanguageServiceHost({
    virtualDocument,
    compilerOptions: SLATE_TYPE_SCRIPT_COMPILER_OPTIONS,
    currentDirectory: fixtureDir,
    readSlateSource: (filename) => sources.get(filename),
    readFile: (filename) => sources.get(filename) ?? ts.sys.readFile(filename),
    fileExists: (filename) => sources.has(filename) || ts.sys.fileExists(filename),
  });
  const service = ts.createLanguageService(host, ts.createDocumentRegistry());
  const diagnostics = [
    ...service.getSyntacticDiagnostics(virtualDocument.virtualFilename),
    ...service.getSemanticDiagnostics(virtualDocument.virtualFilename),
  ];
  service.dispose();
  return normalizeDiagnostics(fixtureDir, virtualDocument, diagnostics);
}

function runCompilerHost(
  fixtureDir: string,
  virtualDocument: SlateVirtualDocument,
  sources: Map<string, string>,
): unknown[] {
  const sourceFile = ts.createSourceFile(
    virtualDocument.virtualFilename,
    virtualDocument.text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const host = createSlateCompilerHost({
    virtualDocument,
    sourceFile,
    compilerOptions: SLATE_TYPE_SCRIPT_COMPILER_OPTIONS,
    currentDirectory: fixtureDir,
    readSlateSource: (filename) => sources.get(filename),
    readFile: (filename) => sources.get(filename) ?? ts.sys.readFile(filename),
    fileExists: (filename) => sources.has(filename) || ts.sys.fileExists(filename),
  });
  const program = ts.createProgram({
    rootNames: [virtualDocument.virtualFilename],
    options: SLATE_TYPE_SCRIPT_COMPILER_OPTIONS,
    host,
  });
  const diagnostics = [
    ...program.getSyntacticDiagnostics(sourceFile),
    ...program.getSemanticDiagnostics(sourceFile),
  ];
  return normalizeDiagnostics(fixtureDir, virtualDocument, diagnostics);
}

function readSlateSources(fixtureDir: string): Map<string, string> {
  const sources = new Map<string, string>();

  for (const filename of readdirSync(fixtureDir).sort()) {
    if (!filename.endsWith(".slate")) {
      continue;
    }

    const path = join(fixtureDir, filename);
    sources.set(path, readFileSync(path, "utf8"));
  }

  return sources;
}

function normalizeDiagnostics(
  fixtureDir: string,
  virtualDocument: SlateVirtualDocument,
  diagnostics: readonly ts.Diagnostic[],
): unknown[] {
  return diagnostics.map((diagnostic) => {
    const start = diagnostic.start ?? 0;
    const end = start + (diagnostic.length ?? 1);
    return {
      file: diagnostic.file ? relative(fixtureDir, diagnostic.file.fileName) : undefined,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      range: normalizeRange(virtualDocument, start, end),
    };
  });
}

function normalizeRange(
  virtualDocument: SlateVirtualDocument,
  virtualStart: number,
  virtualEnd: number,
): {
  start: number;
  end: number;
} | undefined {
  const start = toOriginalOffset(virtualDocument, virtualStart);
  const end = toOriginalOffset(virtualDocument, virtualEnd);

  if (start === undefined || end === undefined) {
    return undefined;
  }

  return {
    start,
    end: Math.max(start + 1, end),
  };
}
