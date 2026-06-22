import { LineMap, type Range } from "./source.ts";

export type DiagnosticSeverity = "error" | "warning";

export type Diagnostic = {
  message: string;
  severity: DiagnosticSeverity;
  range: Range;
  filename?: string;
};

export function error(message: string, range: Range): Diagnostic {
  return {
    message,
    severity: "error",
    range,
  };
}

export function withFilename(diagnostic: Diagnostic, filename: string): Diagnostic {
  return {
    ...diagnostic,
    filename,
  };
}

export function formatDiagnostic(diagnostic: Diagnostic, source?: string): string {
  const location = diagnostic.filename
    ? source
      ? formatLocation(diagnostic.filename, diagnostic.range.start, source)
      : diagnostic.filename
    : undefined;
  const prefix = location ? `${location}: ` : "";
  const header = `${prefix}${diagnostic.severity}: ${diagnostic.message}`;

  if (!source) {
    return header;
  }

  const snippet = formatSourceSnippet(diagnostic.range, source);
  return snippet ? `${header}\n${snippet}` : header;
}

function formatLocation(filename: string, offset: number, source: string): string {
  const position = new LineMap(source).positionAt(offset);
  return `${filename}:${position.line + 1}:${position.character + 1}`;
}

function formatSourceSnippet(range: Range, source: string): string {
  const lineMap = new LineMap(source);
  const start = lineMap.positionAt(range.start);
  const end = lineMap.positionAt(range.end);
  const lineStart = lineMap.lineStarts[start.line] ?? 0;
  const nextLineStart = lineMap.lineStarts[start.line + 1] ?? source.length;
  const rawLine = source.slice(lineStart, nextLineStart).replace(/\r?\n$/, "");

  if (!rawLine) {
    return "";
  }

  const markerStart = start.character;
  const markerEnd = end.line === start.line ? Math.max(end.character, markerStart + 1) : rawLine.length;
  const markerWidth = Math.max(1, markerEnd - markerStart);

  return [
    `  ${rawLine}`,
    `  ${" ".repeat(markerStart)}${"^".repeat(markerWidth)}`,
  ].join("\n");
}
