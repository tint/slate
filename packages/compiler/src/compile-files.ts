import { readFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { withFilename, type Diagnostic } from "./diagnostics.ts";
import { compile } from "./index.ts";

export type CompiledFile = {
  sourcePath: string;
  outputPath: string;
  code: string;
};

export type CompileFilesOptions = {
  entry: string;
  outDir: string;
  kitSpecifier?: string;
};

export type CompileFilesResult = {
  entry: string;
  files: CompiledFile[];
  diagnostics: Diagnostic[];
  sources: Record<string, string>;
};

export async function compileFiles(options: CompileFilesOptions): Promise<CompileFilesResult> {
  const entry = resolve(options.entry);
  const outDir = resolve(options.outDir);
  const kitSpecifier = options.kitSpecifier ?? "@slate/kit";
  const files = new Map<string, CompiledFile>();
  const sources = new Map<string, string>();
  const diagnostics: Diagnostic[] = [];

  await compileFile(entry);

  return {
    entry: outputPathFor(entry),
    files: [...files.values()],
    diagnostics,
    sources: Object.fromEntries(sources),
  };

  async function compileFile(filePath: string): Promise<void> {
    const sourcePath = resolve(filePath);

    if (files.has(sourcePath)) {
      return;
    }

    const source = await readFile(sourcePath, "utf8");
    sources.set(sourcePath, source);
    const result = compile(source, {
      filename: sourcePath,
    });
    diagnostics.push(...result.diagnostics.map((diagnostic) => withFilename(diagnostic, sourcePath)));

    const imports = findSlateImports(result.code);

    for (const specifier of imports) {
      await compileFile(resolve(dirname(sourcePath), specifier));
    }

    const outputPath = outputPathFor(sourcePath);
    const code = rewriteImports(result.code, sourcePath, outputPath);

    files.set(sourcePath, {
      sourcePath,
      outputPath,
      code,
    });
  }

  function outputPathFor(sourcePath: string): string {
    const relativePath = relative(dirname(entry), sourcePath);
    const outputName = relativePath === "" ? "entry.mjs" : relativePath.replace(/\.slate$/, ".mjs");
    return resolve(outDir, outputName === basename(entry) ? "entry.mjs" : outputName);
  }

  function rewriteImports(code: string, sourcePath: string, outputPath: string): string {
    let output = code.replace("\"@slate/kit\"", JSON.stringify(kitSpecifier));

    for (const specifier of findSlateImports(code)) {
      const importedSource = resolve(dirname(sourcePath), specifier);
      const importedOutput = outputPathFor(importedSource);
      let relativeImport = relative(dirname(outputPath), importedOutput).replaceAll("\\", "/");

      if (!relativeImport.startsWith(".")) {
        relativeImport = `./${relativeImport}`;
      }

      output = output.replaceAll(JSON.stringify(specifier), JSON.stringify(relativeImport));
    }

    return output;
  }
}

function findSlateImports(code: string): string[] {
  const imports: string[] = [];
  const importRegex = /\bimport\s+[^"']*["']([^"']+\.slate)["']/g;

  for (const match of code.matchAll(importRegex)) {
    if (match[1]) {
      imports.push(match[1]);
    }
  }

  return imports;
}
