import { Buffer } from "node:buffer";
import { LineMap, type Range } from "./source";

export type SourceMapOption = boolean | "inline" | "hidden";

export type SourceMap = {
  version: 3;
  file?: string;
  sources: string[];
  sourcesContent?: string[];
  names: string[];
  mappings: string;
};

export type SourceMapHint = {
  generatedText: string;
  original: Range;
};

type SourceMapSegment = {
  generatedLine: number;
  generatedColumn: number;
  sourceIndex: number;
  originalLine: number;
  originalColumn: number;
};

export function createSourceMap(input: {
  code: string;
  source: string;
  filename: string;
  hints: SourceMapHint[];
}): SourceMap {
  const generatedLineMap = new LineMap(input.code);
  const originalLineMap = new LineMap(input.source);
  const segments: SourceMapSegment[] = [];
  let searchStart = 0;

  for (const hint of input.hints) {
    const generatedStart = input.code.indexOf(hint.generatedText, searchStart);

    if (generatedStart < 0) {
      continue;
    }

    const generated = generatedLineMap.positionAt(generatedStart);
    const original = originalLineMap.positionAt(hint.original.start);
    segments.push({
      generatedLine: generated.line,
      generatedColumn: generated.character,
      sourceIndex: 0,
      originalLine: original.line,
      originalColumn: original.character,
    });
    searchStart = generatedStart + hint.generatedText.length;
  }

  return {
    version: 3,
    sources: [input.filename],
    sourcesContent: [input.source],
    names: [],
    mappings: encodeMappings(segments),
  };
}

export function appendInlineSourceMap(code: string, map: SourceMap): string {
  const encoded = Buffer.from(JSON.stringify(map), "utf8").toString("base64");
  return `${code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${encoded}`;
}

function encodeMappings(segments: SourceMapSegment[]): string {
  const sorted = [...segments].sort((left, right) =>
    left.generatedLine - right.generatedLine ||
    left.generatedColumn - right.generatedColumn ||
    left.originalLine - right.originalLine ||
    left.originalColumn - right.originalColumn
  );
  const lines: string[] = [];
  let currentLine = 0;
  let previousGeneratedColumn = 0;
  let previousSourceIndex = 0;
  let previousOriginalLine = 0;
  let previousOriginalColumn = 0;

  for (const segment of sorted) {
    while (currentLine < segment.generatedLine) {
      lines.push(";");
      currentLine++;
      previousGeneratedColumn = 0;
    }

    if (lines.length === 0 || lines[lines.length - 1] === ";") {
      lines.push("");
    } else {
      lines.push(",");
    }

    lines.push(
      encodeVlq(segment.generatedColumn - previousGeneratedColumn),
      encodeVlq(segment.sourceIndex - previousSourceIndex),
      encodeVlq(segment.originalLine - previousOriginalLine),
      encodeVlq(segment.originalColumn - previousOriginalColumn),
    );

    previousGeneratedColumn = segment.generatedColumn;
    previousSourceIndex = segment.sourceIndex;
    previousOriginalLine = segment.originalLine;
    previousOriginalColumn = segment.originalColumn;
  }

  return lines.join("");
}

const VLQ_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeVlq(value: number): string {
  let vlq = value < 0 ? ((-value) << 1) + 1 : value << 1;
  let output = "";

  do {
    let digit = vlq & 31;
    vlq >>>= 5;

    if (vlq > 0) {
      digit |= 32;
    }

    output += VLQ_CHARS[digit]!;
  } while (vlq > 0);

  return output;
}
