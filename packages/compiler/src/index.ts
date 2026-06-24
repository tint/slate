export { analyze } from "./analyze.ts";
export type { AnalyzeOptions, AnalyzeResult, ComponentBinding, SlateModule, SlotBinding } from "./analyze.ts";
export { compileFiles } from "./compile-files.ts";
export type { CompiledFile, CompileFilesOptions, CompileFilesResult } from "./compile-files.ts";
export { generate } from "./codegen.ts";
export type { GenerateOptions, GenerateResult } from "./codegen.ts";
export type { SourceMap, SourceMapOption } from "./sourcemap.ts";
export type {
  AttributeCst,
  AwaitBlockCst,
  AwaitBranchCst,
  BlockTagCst,
  CommentCst,
  ConstTagCst,
  DebugDirectiveCst,
  DirectiveAttributeCst,
  EachBlockCst,
  ElementCst,
  HtmlDirectiveCst,
  IfBlockCst,
  InterpolationCst,
  LetTagCst,
  RawTextElementCst,
  SlateFileCst,
  SlateScriptElementCst,
  TagCst,
  TemplateCstNode,
  TextCst,
} from "./cst.ts";
export { formatDiagnostic } from "./diagnostics.ts";
export type { Diagnostic, DiagnosticSeverity } from "./diagnostics.ts";
export { parse } from "./parser.ts";
export type { ParseOptions, ParseResult } from "./parser.ts";
export { LineMap } from "./source.ts";
export type { Position, Range } from "./source.ts";

export type CompileResult = {
  code: string;
  map?: SourceMap;
  diagnostics: Diagnostic[];
};

export type CompileOptions = {
  filename?: string;
  dev?: boolean;
  sourcemap?: SourceMapOption;
};

import type { Diagnostic } from "./diagnostics.ts";
import type { SourceMap, SourceMapOption } from "./sourcemap.ts";
import { parse } from "./parser.ts";
import { analyze } from "./analyze.ts";
import { generate } from "./codegen.ts";

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const parsed = parse(source);
  const analyzed = analyze(parsed.cst);
  const generated = generate(parsed.cst, {
    filename: options.filename,
    source,
    module: analyzed.module,
    dev: options.dev,
    sourcemap: options.sourcemap,
  });

  return {
    code: generated.code,
    map: generated.map,
    diagnostics: [...parsed.diagnostics, ...analyzed.diagnostics, ...generated.diagnostics],
  };
}
