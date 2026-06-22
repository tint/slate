import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import createPlugin from "../src/index";

const root = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(root, "../fixtures");

for (const fixtureName of readdirSync(fixturesDir).sort()) {
  const fixtureDir = join(fixturesDir, fixtureName);
  const entryPath = join(fixtureDir, "entry.ts");

  if (!existsSync(entryPath)) {
    continue;
  }

  const outputPath = join(fixtureDir, "diagnostics.json");
  const files = readFixtureFiles(fixtureDir);
  const host = createHost(fixtureDir, entryPath, files);
  const languageService = ts.createLanguageService(host, ts.createDocumentRegistry());
  const plugin = createPlugin({
    typescript: ts,
  });
  const patchedService = plugin.create({
    languageService,
    languageServiceHost: host,
    project: {
      projectService: {
        logger: {
          info() {},
        },
      },
    },
  } as unknown as ts.server.PluginCreateInfo);
  const source = files.get(entryPath) ?? "";
  const diagnostics = patchedService.getSemanticDiagnostics(entryPath).map((diagnostic) => {
    const start = diagnostic.start ?? 0;
    const end = start + (diagnostic.length ?? 1);
    const startPosition = positionAt(source, start);
    const endPosition = positionAt(source, end);

    return {
      filename: diagnostic.file ? relative(fixtureDir, diagnostic.file.fileName) : undefined,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      range: {
        start: startPosition,
        end: endPosition,
      },
    };
  });

  mkdirSync(fixtureDir, {
    recursive: true,
  });
  writeFileSync(outputPath, `${JSON.stringify(diagnostics, null, 2)}\n`);
}

function readFixtureFiles(fixtureDir: string): Map<string, string> {
  const files = new Map<string, string>();

  for (const filename of readdirSync(fixtureDir).sort()) {
    if (!filename.endsWith(".slate") && !filename.endsWith(".ts")) {
      continue;
    }

    const path = join(fixtureDir, filename);
    files.set(path, readFileSync(path, "utf8"));
  }

  return files;
}

function createHost(
  currentDirectory: string,
  entryPath: string,
  files: Map<string, string>,
): ts.LanguageServiceHost {
  const compilerOptions: ts.CompilerOptions = {
    allowArbitraryExtensions: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
  };

  return {
    getCompilationSettings: () => compilerOptions,
    getCurrentDirectory: () => currentDirectory,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    getScriptFileNames: () => [entryPath],
    getScriptSnapshot: (filename) => {
      const source = files.get(filename) ?? ts.sys.readFile(filename);
      return source === undefined ? undefined : ts.ScriptSnapshot.fromString(source);
    },
    getScriptVersion: () => "0",
    fileExists: (filename) => files.has(filename) || ts.sys.fileExists(filename),
    readFile: (filename) => files.get(filename) ?? ts.sys.readFile(filename),
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
    resolveModuleNameLiterals: (moduleLiterals, containingFile, redirectedReference, options) =>
      moduleLiterals.map((moduleLiteral) =>
        ts.resolveModuleName(
          moduleLiteral.text,
          containingFile,
          options,
          {
            fileExists: (filename) => files.has(filename) || ts.sys.fileExists(filename),
            readFile: (filename) => files.get(filename) ?? ts.sys.readFile(filename),
          },
          undefined,
          redirectedReference,
          moduleResolutionMode(moduleLiteral),
        )
      ),
  };
}

function moduleResolutionMode(moduleLiteral: ts.StringLiteralLike): ts.ResolutionMode | undefined {
  return (moduleLiteral as { impliedNodeFormat?: ts.ResolutionMode }).impliedNodeFormat;
}

function positionAt(source: string, offset: number): {
  line: number;
  character: number;
} {
  let line = 0;
  let lineStart = 0;

  for (let index = 0; index < offset && index < source.length; index++) {
    if (source[index] === "\n") {
      line++;
      lineStart = index + 1;
    }
  }

  return {
    line,
    character: Math.max(0, offset - lineStart),
  };
}
