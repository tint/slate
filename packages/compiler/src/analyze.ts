import type {
  AttributeCst,
  ElementCst,
  RawTextElementCst,
  SlateFileCst,
  SlateScriptElementCst,
  TemplateCstNode,
} from "./cst";
import { error, type Diagnostic } from "./diagnostics";
import type { Range } from "./source";
import ts from "typescript";

export type AnalyzeOptions = {
  filename?: string;
};

export type ComponentBinding = {
  localName: string;
  source: string;
  range: Range;
};

export type SlateModule = {
  script?: SlateScriptElementCst;
  components: ComponentBinding[];
  diagnostics: Diagnostic[];
};

export type AnalyzeResult = {
  module: SlateModule;
  diagnostics: Diagnostic[];
};

export function analyze(cst: SlateFileCst, _options: AnalyzeOptions = {}): AnalyzeResult {
  const diagnostics: Diagnostic[] = [];
  const scripts = collectSlateScripts(cst);

  if (scripts.length > 1) {
    for (const script of scripts.slice(1)) {
      diagnostics.push(error("Only one <script slate> block is allowed.", script.openTag.range));
    }
  }

  const script = scripts[0];

  if (script) {
    diagnostics.push(...validateSlateScript(script));
  }

  for (const child of cst.children) {
    diagnostics.push(...validateTemplateNode(child));
  }

  const components = script ? collectComponentImports(script) : [];
  const module: SlateModule = {
    script,
    components,
    diagnostics,
  };

  return {
    module,
    diagnostics,
  };
}

function collectSlateScripts(cst: SlateFileCst): SlateScriptElementCst[] {
  const scripts: SlateScriptElementCst[] = [];

  for (const child of cst.children) {
    if (child.kind === "SlateScriptElement") {
      scripts.push(child);
    }
  }

  return scripts;
}

function validateSlateScript(script: SlateScriptElementCst): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const attr of script.openTag.attributes) {
    if (attr.kind === "DirectiveAttribute" && attr.namespace === "is") {
      diagnostics.push(error("`is:*` directives are not allowed on <script slate>.", attr.range));
    }
  }

  diagnostics.push(...validateTypeOnlyExports(script));

  return diagnostics;
}

function validateTypeOnlyExports(script: SlateScriptElementCst): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const text = script.body.text;
  const bodyStart = script.body.range.start;
  const sourceFile = ts.createSourceFile("component.slate.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  for (const statement of sourceFile.statements) {
    if (!hasExportModifier(statement)) {
      continue;
    }

    if (isAllowedTypeExport(statement)) {
      continue;
    }

    diagnostics.push(
      error("Only TypeScript type exports are allowed in <script slate>.", {
        start: bodyStart + statement.getStart(sourceFile),
        end: bodyStart + statement.getEnd(),
      }),
    );
  }

  return diagnostics;
}

function collectComponentImports(script: SlateScriptElementCst): ComponentBinding[] {
  const components: ComponentBinding[] = [];
  const text = script.body.text;
  const bodyStart = script.body.range.start;
  const sourceFile = ts.createSourceFile("component.slate.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    const source = statement.moduleSpecifier.text;

    if (!source.endsWith(".slate")) {
      continue;
    }

    const defaultImport = statement.importClause?.name;

    if (!defaultImport) {
      continue;
    }

    components.push({
      localName: defaultImport.text,
      source,
      range: {
        start: bodyStart + statement.getStart(sourceFile),
        end: bodyStart + statement.getEnd(),
      },
    });
  }

  return components;
}

function hasExportModifier(statement: ts.Statement): boolean {
  return Boolean(
    ts.canHaveModifiers(statement) &&
      ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
  );
}

function isAllowedTypeExport(statement: ts.Statement): boolean {
  if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
    return true;
  }

  if (ts.isExportDeclaration(statement)) {
    return statement.isTypeOnly;
  }

  return false;
}

function validateTemplateNode(node: TemplateCstNode): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (node.kind === "Element") {
    diagnostics.push(...validateElement(node));
  }

  if (node.kind === "RawTextElement") {
    diagnostics.push(...validateRawTextElement(node));
  }

  if (node.kind === "IfBlock") {
    for (const child of node.then) {
      diagnostics.push(...validateTemplateNode(child));
    }

    for (const child of node.else ?? []) {
      diagnostics.push(...validateTemplateNode(child));
    }
  }

  if (node.kind === "EachBlock") {
    for (const child of node.children) {
      diagnostics.push(...validateTemplateNode(child));
    }

    for (const child of node.else ?? []) {
      diagnostics.push(...validateTemplateNode(child));
    }
  }

  return diagnostics;
}

function validateRawTextElement(element: RawTextElementCst): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const globalAttr = findDirective(element.openTag.attributes, "is", "global");
  const inlineAttr = findDirective(element.openTag.attributes, "is", "inline");
  const srcAttr = element.openTag.attributes.find((attr) => attr.name === "src");

  if (globalAttr && inlineAttr) {
    diagnostics.push(error("`is:global` and `is:inline` cannot be used together.", inlineAttr.range));
  }

  if (element.tagName === "script" && srcAttr && (globalAttr || inlineAttr)) {
    diagnostics.push(error("`is:*` directives are not allowed on `<script src>`.", (globalAttr ?? inlineAttr)!.range));
  }

  if (inlineAttr?.valueKind) {
    diagnostics.push(error("`is:inline` must not have a value.", inlineAttr.range));
  }

  if (!globalAttr) {
    return diagnostics;
  }

  if (element.tagName === "style") {
    if (globalAttr.valueKind) {
      diagnostics.push(error("`is:global` on `<style>` must not have a value.", globalAttr.range));
    }
    return diagnostics;
  }

  if (!globalAttr.valueKind) {
    return diagnostics;
  }

  if (globalAttr.valueKind !== "string") {
    diagnostics.push(error("`is:global` on `<script>` must use a static string value.", globalAttr.range));
    return diagnostics;
  }

  if (globalAttr.value !== "head" && globalAttr.value !== "tail") {
    diagnostics.push(error("`is:global` on `<script>` only accepts `head` or `tail`.", globalAttr.range));
  }

  return diagnostics;
}

function validateElement(element: ElementCst): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  diagnostics.push(...validateAttributes(element.openTag.attributes));

  if (element.tagName === "slot") {
    diagnostics.push(...validateSlotOutlet(element));
  }

  for (const child of element.children) {
    diagnostics.push(...validateTemplateNode(child));
  }

  return diagnostics;
}

function validateAttributes(attributes: AttributeCst[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const attr of attributes) {
    if ((attr.kind === "StringAttribute" || attr.kind === "BooleanAttribute") && attr.name === "slot") {
      diagnostics.push(error("Use `slot:name` for Slate slot assignment, not `slot=\"name\"`.", attr.range));
      continue;
    }

    if (attr.kind !== "DirectiveAttribute" || attr.namespace !== "slot") {
      continue;
    }

    if (!attr.directiveName) {
      diagnostics.push(error("Expected a slot name after `slot:`.", attr.range));
      continue;
    }

    if (attr.valueKind === "string") {
      diagnostics.push(error("Use `slot:name={pattern}` to bind slot data, not a string value.", attr.range));
    }
  }

  return diagnostics;
}

function findDirective(attributes: AttributeCst[], namespace: string, directiveName: string): Extract<AttributeCst, { kind: "DirectiveAttribute" }> | undefined {
  return attributes.find(
    (attr): attr is Extract<AttributeCst, { kind: "DirectiveAttribute" }> =>
      attr.kind === "DirectiveAttribute" &&
      attr.namespace === namespace &&
      attr.directiveName === directiveName,
  );
}

function validateSlotOutlet(element: ElementCst): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const attr of element.openTag.attributes) {
    if (attr.kind === "DirectiveAttribute" && attr.namespace === "slot") {
      diagnostics.push(error("`slot:*` assigns content to a component slot and is not allowed on `<slot>` outlets.", attr.range));
      continue;
    }

    if (attr.name === "name" && attr.kind !== "StringAttribute") {
      diagnostics.push(error("`<slot>` name must be a static string attribute.", attr.range));
      continue;
    }

    if (attr.name === "data" && attr.kind !== "ExpressionAttribute") {
      diagnostics.push(error("`<slot>` data must use an expression attribute, for example `data={value}`.", attr.range));
      continue;
    }
  }

  return diagnostics;
}
