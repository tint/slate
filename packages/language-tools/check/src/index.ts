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
  type SlateScriptElementCst,
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
  attributeDiagnostics?: AttributeDiagnosticInput[];
  attributeDiagnosticsDefaultSeverity?: AttributeDiagnosticsDefaultSeverity;
};

export type CheckFilesResult = {
  diagnostics: Diagnostic[];
  sources: Record<string, string>;
};

export type CheckSourceOptions = {
  source: string;
  filename: string;
  attributeDiagnostics?: AttributeDiagnosticInput[];
  attributeDiagnosticsDefaultSeverity?: AttributeDiagnosticsDefaultSeverity;
};

export type CheckSourceResult = {
  diagnostics: Diagnostic[];
  sources: Record<string, string>;
};

type NormalizedCheckSourceOptions = Omit<
  CheckSourceOptions,
  "attributeDiagnostics" | "attributeDiagnosticsDefaultSeverity"
> & {
  attributeDiagnostics?: AttributeDiagnosticRule[];
};

export type AttributeDiagnosticSeverity = Diagnostic["severity"] | "off";

export type AttributeDiagnosticPattern = string | RegExp;

export type AttributeDiagnosticRule = {
  /** String patterns match exactly, except `*` may be used as a prefix/suffix wildcard. */
  pattern: AttributeDiagnosticPattern;
  severity?: AttributeDiagnosticSeverity;
  message?: string;
};

export type AttributeDiagnosticInput = AttributeDiagnosticPattern | AttributeDiagnosticRule;

export type AttributeDiagnosticsDefaultSeverity =
  | AttributeDiagnosticSeverity
  | {
    default?: AttributeDiagnosticSeverity;
    string?: AttributeDiagnosticSeverity;
    regexp?: AttributeDiagnosticSeverity;
    error?: AttributeDiagnosticPattern[];
    warning?: AttributeDiagnosticPattern[];
    off?: AttributeDiagnosticPattern[];
  }
  | Array<{
    patterns: AttributeDiagnosticPattern[];
    severity: AttributeDiagnosticSeverity;
  }>;

export function normalizeAttributeDiagnosticRules(
  value: unknown,
  defaultSeverity?: AttributeDiagnosticsDefaultSeverity,
): AttributeDiagnosticRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rules: AttributeDiagnosticRule[] = [];

  for (const item of value) {
    const rule = normalizeAttributeDiagnosticRule(item, defaultSeverity);

    if (!rule) {
      continue;
    }

    rules.push(rule);
  }

  return rules;
}

function normalizeAttributeDiagnosticRule(
  value: unknown,
  defaultSeverity: AttributeDiagnosticsDefaultSeverity | undefined,
): AttributeDiagnosticRule | undefined {
  if (isAttributeDiagnosticPattern(value)) {
    return {
      pattern: value,
      severity: resolveAttributeDiagnosticDefaultSeverity(value, defaultSeverity),
    };
  }

  if (!isRecord(value) || !isAttributeDiagnosticPattern(value.pattern)) {
    return undefined;
  }

  return {
    pattern: value.pattern,
    severity: normalizeAttributeDiagnosticSeverityOption(value.severity)
      ?? resolveAttributeDiagnosticDefaultSeverity(value.pattern, defaultSeverity),
    message: typeof value.message === "string" ? value.message : undefined,
  };
}

function isAttributeDiagnosticPattern(value: unknown): value is AttributeDiagnosticPattern {
  return (typeof value === "string" && value.length > 0) || value instanceof RegExp;
}

export function checkSource(options: CheckSourceOptions): CheckSourceResult {
  const attributeDiagnosticRules = normalizeAttributeDiagnosticRules(
    options.attributeDiagnostics,
    options.attributeDiagnosticsDefaultSeverity,
  );
  const result = compile(options.source);
  const filename = options.filename;
  const typeDiagnostics = checkVirtualDocument({
    source: options.source,
    filename,
    attributeDiagnostics: attributeDiagnosticRules,
  });
  const attributeDiagnostics = checkAttributeDiagnostics({
    source: options.source,
    filename,
    rules: attributeDiagnosticRules,
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
  const attributeDiagnosticRules = normalizeAttributeDiagnosticRules(
    options.attributeDiagnostics,
    options.attributeDiagnosticsDefaultSeverity,
  );
  const outDir = await mkdtemp(join(tmpdir(), `slate-check-${randomBytes(6).toString("hex")}-`));
  const result = await compileFiles({
    entry: options.entry,
    outDir,
  });
  const entrySource = result.sources[options.entry] ?? (await readFile(options.entry, "utf8"));
  const typeDiagnostics = checkVirtualDocument({
    source: entrySource,
    filename: options.entry,
    attributeDiagnostics: attributeDiagnosticRules,
  });
  const attributeDiagnostics = Object.entries(result.sources).flatMap(([filename, source]) =>
    checkAttributeDiagnostics({
      source,
      filename,
      rules: attributeDiagnosticRules,
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

  if (node.kind === "AwaitBlock") {
    for (const child of node.pending) {
      collectAttributeDiagnosticsFromNode(child, filename, rules, diagnostics);
    }

    for (const child of node.then?.children ?? []) {
      collectAttributeDiagnosticsFromNode(child, filename, rules, diagnostics);
    }

    for (const child of node.catch?.children ?? []) {
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

function matchesAttributePattern(pattern: AttributeDiagnosticPattern, rawName: string): boolean {
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

function normalizeAttributeDiagnosticSeverity(value: unknown): AttributeDiagnosticSeverity {
  return value === "error" || value === "warning" || value === "off" ? value : "warning";
}

function normalizeAttributeDiagnosticSeverityOption(value: unknown): AttributeDiagnosticSeverity | undefined {
  return value === "error" || value === "warning" || value === "off" ? value : undefined;
}

function resolveAttributeDiagnosticDefaultSeverity(
  pattern: AttributeDiagnosticPattern,
  value: AttributeDiagnosticsDefaultSeverity | undefined,
): AttributeDiagnosticSeverity {
  const severity = normalizeAttributeDiagnosticSeverityOption(value);

  if (severity) {
    return severity;
  }

  if (Array.isArray(value)) {
    for (const group of value) {
      if (!isRecord(group)) {
        continue;
      }

      const groupSeverity = normalizeAttributeDiagnosticSeverityOption(group.severity);
      const patterns = Array.isArray(group.patterns) ? group.patterns : [];

      if (groupSeverity && patterns.some((item) => isAttributeDiagnosticPattern(item) && sameAttributeDiagnosticPattern(item, pattern))) {
        return groupSeverity;
      }
    }

    return "warning";
  }

  if (!isRecord(value)) {
    return "warning";
  }

  for (const severityName of ["error", "warning", "off"] as const) {
    const patterns = value[severityName];

    if (
      Array.isArray(patterns) &&
      patterns.some((item) => isAttributeDiagnosticPattern(item) && sameAttributeDiagnosticPattern(item, pattern))
    ) {
      return severityName;
    }
  }

  const byPatternKind = pattern instanceof RegExp
    ? normalizeAttributeDiagnosticSeverityOption(value.regexp)
    : normalizeAttributeDiagnosticSeverityOption(value.string);

  return byPatternKind ?? normalizeAttributeDiagnosticSeverity(value.default);
}

function sameAttributeDiagnosticPattern(a: AttributeDiagnosticPattern, b: AttributeDiagnosticPattern): boolean {
  if (typeof a === "string" || typeof b === "string") {
    return a === b;
  }

  return a.source === b.source && a.flags === b.flags;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkVirtualDocument(options: NormalizedCheckSourceOptions): Diagnostic[] {
  const virtualDocument = createSlateVirtualDocument(options.source, options.filename);
  const importedComponents = collectImportedSlateComponentNames(virtualDocument.script);

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
    ...checkLocalJsxComponentDiagnostics(sourceFile, virtualDocument, importedComponents),
  ];
}

function collectImportedSlateComponentNames(script: SlateScriptElementCst | undefined): Set<string> {
  const names = new Set<string>();

  if (!script) {
    return names;
  }

  const sourceFile = ts.createSourceFile(
    "component.slate.tsx",
    script.body.text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    if (!statement.moduleSpecifier.text.endsWith(".slate")) {
      continue;
    }

    const defaultImport = statement.importClause?.name;

    if (defaultImport) {
      names.add(defaultImport.text);
    }
  }

  return names;
}

function checkLocalJsxComponentDiagnostics(
  sourceFile: ts.SourceFile,
  virtualDocument: SlateVirtualDocument,
  importedComponents: Set<string>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  visit(sourceFile);
  return diagnostics;

  function visit(node: ts.Node): void {
    const tagName = jsxElementTagName(node);

    if (tagName && isComponentLikeJsxTag(tagName.text) && !importedComponents.has(tagName.text)) {
      const originalRange = toOriginalRange(virtualDocument, tagName.getStart(sourceFile), tagName.getEnd());

      if (originalRange) {
        diagnostics.push({
          filename: virtualDocument.filename,
          range: originalRange,
          severity: "error",
          message: "Local TSX components are not supported in Slate JSX. Use an intrinsic HTML/SVG element or an imported `.slate` component.",
        });
      }
    }

    ts.forEachChild(node, visit);
  }
}

function jsxElementTagName(node: ts.Node): ts.Identifier | undefined {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    return ts.isIdentifier(node.tagName) ? node.tagName : undefined;
  }

  return undefined;
}

function isComponentLikeJsxTag(value: string): boolean {
  return /^[A-Z]/.test(value);
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
