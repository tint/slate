import type { Diagnostic } from "./diagnostics";
import type { Range } from "./source";

export type CstNodeBase = {
  kind: string;
  range: Range;
  diagnostics?: Diagnostic[];
};

export type SlateFileCst = CstNodeBase & {
  kind: "SlateFile";
  children: TemplateCstNode[];
};

export type TemplateCstNode =
  | TextCst
  | CommentCst
  | ElementCst
  | RawTextElementCst
  | SlateScriptElementCst
  | InterpolationCst
  | HtmlDirectiveCst
  | DebugDirectiveCst
  | ConstTagCst
  | LetTagCst
  | IfBlockCst
  | EachBlockCst
  | ErrorCst;

export type TextCst = CstNodeBase & {
  kind: "Text";
  text: string;
};

export type CommentCst = CstNodeBase & {
  kind: "Comment";
  text: string;
  closed: boolean;
};

export type ElementCst = CstNodeBase & {
  kind: "Element";
  tagName: string;
  rawTagName: string;
  openTag: TagCst;
  children: TemplateCstNode[];
  closeTag?: TagCst;
  selfClosing: boolean;
};

export type RawTextElementCst = CstNodeBase & {
  kind: "RawTextElement";
  tagName: "script" | "style";
  rawTagName: string;
  openTag: TagCst;
  body: RawTextCst;
  closeTag?: TagCst;
};

export type SlateScriptElementCst = CstNodeBase & {
  kind: "SlateScriptElement";
  openTag: TagCst;
  body: RawTextCst;
  closeTag?: TagCst;
};

export type RawTextCst = CstNodeBase & {
  kind: "RawText";
  text: string;
};

export type TagCst = CstNodeBase & {
  kind: "Tag";
  tagName: string;
  rawTagName: string;
  attributes: AttributeCst[];
  selfClosing: boolean;
  closing: boolean;
};

export type AttributeCst =
  | BooleanAttributeCst
  | StringAttributeCst
  | ExpressionAttributeCst
  | DirectiveAttributeCst;

export type AttributeBase = CstNodeBase & {
  name: string;
  rawName: string;
};

export type BooleanAttributeCst = AttributeBase & {
  kind: "BooleanAttribute";
};

export type StringAttributeCst = AttributeBase & {
  kind: "StringAttribute";
  value: string;
  quote: "\"" | "'";
};

export type ExpressionAttributeCst = AttributeBase & {
  kind: "ExpressionAttribute";
  expression: TsIslandCst;
  closed: boolean;
};

export type DirectiveAttributeCst = AttributeBase & {
  kind: "DirectiveAttribute";
  namespace: string;
  directiveName: string;
  value?: StringAttributeCst["value"] | TsIslandCst;
  valueKind?: "string" | "expression";
  closed?: boolean;
};

export type TsIslandCst = {
  range: Range;
  text: string;
};

export type InterpolationCst = CstNodeBase & {
  kind: "Interpolation";
  expression: TsIslandCst;
  closed: boolean;
};

export type HtmlDirectiveCst = CstNodeBase & {
  kind: "HtmlDirective";
  expression: TsIslandCst;
  closed: boolean;
};

export type DebugDirectiveCst = CstNodeBase & {
  kind: "DebugDirective";
  expression: TsIslandCst;
  closed: boolean;
};

export type ConstTagCst = CstNodeBase & {
  kind: "ConstTag";
  statement: TsIslandCst;
  closed: boolean;
};

export type LetTagCst = CstNodeBase & {
  kind: "LetTag";
  statement: TsIslandCst;
  closed: boolean;
};

export type BlockTagCst = CstNodeBase & {
  kind: "BlockTag";
  name: string;
  expression?: TsIslandCst;
  closed: boolean;
};

export type IfBlockCst = CstNodeBase & {
  kind: "IfBlock";
  open: BlockTagCst;
  then: TemplateCstNode[];
  else?: TemplateCstNode[];
  close?: BlockTagCst;
};

export type EachBlockCst = CstNodeBase & {
  kind: "EachBlock";
  open: BlockTagCst;
  expression: TsIslandCst;
  item: string;
  index?: string;
  children: TemplateCstNode[];
  else?: TemplateCstNode[];
  close?: BlockTagCst;
};

export type ErrorCst = CstNodeBase & {
  kind: "Error";
  text: string;
};
