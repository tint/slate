import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import type { Diagnostic } from "@slate/compiler";
import {
  compile,
  compileFiles,
  type Diagnostic as CompilerDiagnostic,
} from "@slate/compiler";
import {
  createSlateCompilerHost,
  createSlateVirtualDocument,
  SLATE_TYPE_SCRIPT_COMPILER_OPTIONS,
  toOriginalOffset,
  type SlateVirtualDocument,
} from "@slate/ts-plugin";
import ts from "typescript";

export type CheckFilesOptions = {
  entry: string;
};

export type CheckFilesResult = {
  diagnostics: Diagnostic[];
  sources: Record<string, string>;
};

export type CheckSourceOptions = {
  source: string;
  filename: string;
};

export type CheckSourceResult = {
  diagnostics: Diagnostic[];
  sources: Record<string, string>;
};

export function checkSource(options: CheckSourceOptions): CheckSourceResult {
  const result = compile(options.source);
  const filename = options.filename;
  const typeDiagnostics = checkVirtualDocument({
    source: options.source,
    filename,
  });

  return {
    diagnostics: [
      ...result.diagnostics.map((diagnostic: CompilerDiagnostic) => ({
        ...diagnostic,
        filename,
      })),
      ...typeDiagnostics,
    ],
    sources: {
      [filename]: options.source,
    },
  };
}

export async function checkFiles(options: CheckFilesOptions): Promise<CheckFilesResult> {
  const outDir = await mkdtemp(join(tmpdir(), `slate-check-${randomBytes(6).toString("hex")}-`));
  const result = await compileFiles({
    entry: options.entry,
    outDir,
  });
  const entrySource = result.sources[options.entry] ?? (await readFile(options.entry, "utf8"));
  const typeDiagnostics = checkVirtualDocument({
    source: entrySource,
    filename: options.entry,
  });

  return {
    diagnostics: [...result.diagnostics, ...typeDiagnostics],
    sources: {
      ...result.sources,
      [options.entry]: entrySource,
    },
  };
}

function checkVirtualDocument(options: CheckSourceOptions): Diagnostic[] {
  const virtualDocument = createSlateVirtualDocument(options.source, options.filename);

  const sourceFile = ts.createSourceFile(
    virtualDocument.virtualFilename,
    virtualDocument.text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const host = createSlateCompilerHost({
    virtualDocument,
    sourceFile,
    compilerOptions: SLATE_TYPE_SCRIPT_COMPILER_OPTIONS,
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

  return diagnostics.flatMap((diagnostic) => toSlateDiagnostic(diagnostic, virtualDocument));
}

function toSlateDiagnostic(diagnostic: ts.Diagnostic, virtualDocument: SlateVirtualDocument): Diagnostic[] {
  if (diagnostic.start === undefined) {
    return [];
  }

  const length = diagnostic.length ?? 1;
  const originalRange = toOriginalRange(virtualDocument, diagnostic.start, diagnostic.start + length);

  if (!originalRange) {
    return [];
  }

  return [
    {
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      severity: diagnostic.category === ts.DiagnosticCategory.Warning ? "warning" : "error",
      range: {
        start: originalRange.start,
        end: Math.max(originalRange.start + 1, originalRange.end),
      },
      filename: virtualDocument.filename,
    },
  ];
}

function toOriginalRange(
  virtualDocument: SlateVirtualDocument,
  virtualStart: number,
  virtualEnd: number,
): { start: number; end: number } | undefined {
  const containingMapping = virtualDocument.mappings.find((mapping) =>
    mapping.original &&
    virtualStart >= mapping.generated.start &&
    virtualEnd <= mapping.generated.end
  );

  if (containingMapping?.original) {
    const generatedLength = containingMapping.generated.end - containingMapping.generated.start;
    const originalLength = containingMapping.original.end - containingMapping.original.start;

    if (generatedLength !== originalLength) {
      return containingMapping.original;
    }
  }

  const originalStart = toOriginalOffset(virtualDocument, virtualStart);
  const originalEnd = toOriginalOffset(virtualDocument, virtualEnd);

  if (originalStart === undefined || originalEnd === undefined) {
    return undefined;
  }

  return {
    start: originalStart,
    end: originalEnd,
  };
}
