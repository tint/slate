import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import type { Diagnostic } from "@slate/compiler";
import {
  compile,
  compileFiles,
  parse,
  type AttributeCst,
  type Diagnostic as CompilerDiagnostic,
  type SlateFileCst,
  type TemplateCstNode,
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
  attributeDiagnostics?: AttributeDiagnosticRule[];
};

export type CheckFilesResult = {
  diagnostics: Diagnostic[];
  sources: Record<string, string>;
};

export type CheckSourceOptions = {
  source: string;
  filename: string;
  attributeDiagnostics?: AttributeDiagnosticRule[];
};

export type CheckSourceResult = {
  diagnostics: Diagnostic[];
  sources: Record<string, string>;
};

export type AttributeDiagnosticSeverity = Diagnostic["severity"] | "off";

export type AttributeDiagnosticRule = {
  /** String patterns match exactly, except `*` may be used as a prefix/suffix wildcard. */
  pattern: string | RegExp;
  severity?: AttributeDiagnosticSeverity;
  message?: string;
};

export function checkSource(options: CheckSourceOptions): CheckSourceResult {
  const result = compile(options.source);
  const filename = options.filename;
  const typeDiagnostics = checkVirtualDocument({
    source: options.source,
    filename,
    attributeDiagnostics: options.attributeDiagnostics,
  });
  const attributeDiagnostics = checkAttributeDiagnostics({
    source: options.source,
    filename,
    rules: options.attributeDiagnostics,
  });

  return {
    diagnostics: [
      ...result.diagnostics.map((diagnostic: CompilerDiagnostic) => ({
        ...diagnostic,
        filename,
      })),
      ...typeDiagnostics,
      ...attributeDiagnostics,
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
    attributeDiagnostics: options.attributeDiagnostics,
  });
  const attributeDiagnostics = Object.entries(result.sources).flatMap(([filename, source]) =>
    checkAttributeDiagnostics({
      source,
      filename,
      rules: options.attributeDiagnostics,
    })
  );

  return {
    diagnostics: [...result.diagnostics, ...typeDiagnostics, ...attributeDiagnostics],
    sources: {
      ...result.sources,
      [options.entry]: entrySource,
    },
  };
}

function checkAttributeDiagnostics(options: {
  source: string;
  filename: string;
  rules?: AttributeDiagnosticRule[];
}): Diagnostic[] {
  const rules = options.rules?.filter((rule) => (rule.severity ?? "warning") !== "off") ?? [];

  if (!rules.length) {
    return [];
  }

  const parsed = parse(options.source);
  const diagnostics: Diagnostic[] = [];

  for (const child of (parsed.cst as SlateFileCst).children) {
    collectAttributeDiagnosticsFromNode(child, options.filename, rules, diagnostics);
  }

  return diagnostics;
}

function collectAttributeDiagnosticsFromNode(
  node: TemplateCstNode,
  filename: string,
  rules: AttributeDiagnosticRule[],
  diagnostics: Diagnostic[],
): void {
  if (node.kind === "Element") {
    collectAttributeDiagnosticsFromAttributes(node.openTag.attributes, filename, rules, diagnostics);

    for (const child of node.children) {
      collectAttributeDiagnosticsFromNode(child, filename, rules, diagnostics);
    }

    return;
  }

  if (node.kind === "RawTextElement" || node.kind === "SlateScriptElement") {
    collectAttributeDiagnosticsFromAttributes(node.openTag.attributes, filename, rules, diagnostics);
    return;
  }

  if (node.kind === "IfBlock") {
    for (const child of node.then) {
      collectAttributeDiagnosticsFromNode(child, filename, rules, diagnostics);
    }

    for (const child of node.else ?? []) {
      collectAttributeDiagnosticsFromNode(child, filename, rules, diagnostics);
    }

    return;
  }

  if (node.kind === "EachBlock") {
    for (const child of node.children) {
      collectAttributeDiagnosticsFromNode(child, filename, rules, diagnostics);
    }

    for (const child of node.else ?? []) {
      collectAttributeDiagnosticsFromNode(child, filename, rules, diagnostics);
    }

    return;
  }

}

function collectAttributeDiagnosticsFromAttributes(
  attributes: AttributeCst[],
  filename: string,
  rules: AttributeDiagnosticRule[],
  diagnostics: Diagnostic[],
): void {
  for (const attribute of attributes) {
    for (const rule of rules) {
      if (!matchesAttributePattern(rule.pattern, attribute.rawName)) {
        continue;
      }

      diagnostics.push({
        filename,
        range: attribute.range,
        severity: rule.severity === "error" ? "error" : "warning",
        message: rule.message ?? `Attribute \`${attribute.rawName}\` matched Slate diagnostic rule.`,
      });
      break;
    }
  }
}

function matchesAttributePattern(pattern: AttributeDiagnosticRule["pattern"], rawName: string): boolean {
  if (pattern instanceof RegExp) {
    pattern.lastIndex = 0;
    return pattern.test(rawName);
  }

  if (pattern === rawName || pattern === "*") {
    return true;
  }

  if (pattern.startsWith("*") && pattern.endsWith("*") && pattern.length > 2) {
    return rawName.includes(pattern.slice(1, -1));
  }

  if (pattern.startsWith("*")) {
    return rawName.endsWith(pattern.slice(1));
  }

  if (pattern.endsWith("*")) {
    return rawName.startsWith(pattern.slice(0, -1));
  }

  return false;
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

  return [
    ...diagnostics.flatMap((diagnostic) => toSlateDiagnostic(diagnostic, virtualDocument)),
    ...checkJsxAttributeDiagnostics(sourceFile, virtualDocument, options.attributeDiagnostics),
  ];
}

function checkJsxAttributeDiagnostics(
  sourceFile: ts.SourceFile,
  virtualDocument: SlateVirtualDocument,
  rules?: AttributeDiagnosticRule[],
): Diagnostic[] {
  const activeRules = rules?.filter((rule) => (rule.severity ?? "warning") !== "off") ?? [];

  if (!activeRules.length) {
    return [];
  }

  const diagnostics: Diagnostic[] = [];

  visit(sourceFile);
  return diagnostics;

  function visit(node: ts.Node): void {
    if (ts.isJsxAttribute(node)) {
      const rawName = node.name.getText(sourceFile);

      for (const rule of activeRules) {
        if (!matchesAttributePattern(rule.pattern, rawName)) {
          continue;
        }

        const originalRange = toOriginalRange(virtualDocument, node.name.getStart(sourceFile), node.name.getEnd());

        if (originalRange) {
          diagnostics.push({
            filename: virtualDocument.filename,
            range: originalRange,
            severity: rule.severity === "error" ? "error" : "warning",
            message: rule.message ?? `Attribute \`${rawName}\` matched Slate diagnostic rule.`,
          });
        }

        break;
      }
    }

    ts.forEachChild(node, visit);
  }
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
