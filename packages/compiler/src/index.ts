export { analyze } from "./analyze";
export type { AnalyzeOptions, AnalyzeResult, ComponentBinding, SlateModule } from "./analyze";
export { compileFiles } from "./compile-files";
export type { CompiledFile, CompileFilesOptions, CompileFilesResult } from "./compile-files";
export { generate } from "./codegen";
export type { GenerateOptions, GenerateResult } from "./codegen";
export type {
  AttributeCst,
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
} from "./cst";
export { formatDiagnostic } from "./diagnostics";
export type { Diagnostic, DiagnosticSeverity } from "./diagnostics";
export { parse } from "./parser";
export type { ParseOptions, ParseResult } from "./parser";
export { LineMap } from "./source";
export type { Position, Range } from "./source";

export type CompileResult = {
  code: string;
  diagnostics: Diagnostic[];
};

export type CompileOptions = {
  filename?: string;
};

import type { Diagnostic } from "./diagnostics";
import { parse } from "./parser";
import { analyze } from "./analyze";
import { generate } from "./codegen";

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const parsed = parse(source);
  const analyzed = analyze(parsed.cst);
  const generated = generate(parsed.cst, {
    filename: options.filename,
    module: analyzed.module,
  });

  return {
    code: generated.code,
    diagnostics: [...parsed.diagnostics, ...analyzed.diagnostics, ...generated.diagnostics],
  };
}
