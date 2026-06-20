import type {
  AttributeCst,
  ElementCst,
  SlateFileCst,
  SlateScriptElementCst,
  TemplateCstNode,
  TsIslandCst,
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

type AnalyzeContext = {
  cloneability: CloneabilityContext;
};

type CloneabilityContext = {
  bindings: Map<string, ts.Node>;
  sourceFile?: ts.SourceFile;
  bodyStart: number;
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

  const context = createAnalyzeContext(script);

  for (const child of cst.children) {
    diagnostics.push(...validateTemplateNode(child, context));
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
  diagnostics.push(...validateCloneableRunes(script));

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

function validateTemplateNode(node: TemplateCstNode, context: AnalyzeContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (node.kind === "Element") {
    diagnostics.push(...validateElement(node, context));
  }

  if (node.kind === "IfBlock") {
    for (const child of node.then) {
      diagnostics.push(...validateTemplateNode(child, context));
    }

    for (const child of node.else ?? []) {
      diagnostics.push(...validateTemplateNode(child, context));
    }
  }

  if (node.kind === "EachBlock") {
    for (const child of node.children) {
      diagnostics.push(...validateTemplateNode(child, context));
    }

    for (const child of node.else ?? []) {
      diagnostics.push(...validateTemplateNode(child, context));
    }
  }

  return diagnostics;
}

function validateElement(element: ElementCst, context: AnalyzeContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  diagnostics.push(...validateAttributes(element.openTag.attributes));

  if (element.tagName === "slot") {
    diagnostics.push(...validateSlotOutlet(element, context));
  }

  for (const child of element.children) {
    diagnostics.push(...validateTemplateNode(child, context));
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

function validateSlotOutlet(element: ElementCst, context: AnalyzeContext): Diagnostic[] {
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

    if (attr.name === "data" && attr.kind === "ExpressionAttribute") {
      diagnostics.push(
        ...validateCloneableTsIsland(
          attr.expression,
          context.cloneability,
          "`<slot>` data must be cloneable data.",
        ),
      );
    }
  }

  return diagnostics;
}

function createAnalyzeContext(script: SlateScriptElementCst | undefined): AnalyzeContext {
  return {
    cloneability: createCloneabilityContext(script),
  };
}

function createCloneabilityContext(script: SlateScriptElementCst | undefined): CloneabilityContext {
  if (!script) {
    return {
      bindings: new Map(),
      bodyStart: 0,
    };
  }

  const sourceFile = ts.createSourceFile("component.slate.ts", script.body.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const bindings = new Map<string, ts.Node>();

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      if (statement.name) {
        bindings.set(statement.name.text, statement);
      }

      continue;
    }

    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) {
        bindings.set(declaration.name.text, declaration);
      }
    }
  }

  return {
    bindings,
    sourceFile,
    bodyStart: script.body.range.start,
  };
}

function validateCloneableRunes(script: SlateScriptElementCst): Diagnostic[] {
  const context = createCloneabilityContext(script);
  const sourceFile = context.sourceFile;
  const diagnostics: Diagnostic[] = [];

  if (!sourceFile) {
    return diagnostics;
  }

  const scriptSourceFile = sourceFile;

  function visit(node: ts.Node): void {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) {
      ts.forEachChild(node, visit);
      return;
    }

    if (node.expression.text === "$provide") {
      const value = node.arguments[1];

      if (value) {
        diagnostics.push(
          ...validateCloneableExpression(
            value,
            scriptSourceFile,
            context,
            script.body.range.start,
            "`$provide` value must be cloneable data.",
          ),
        );
      }
    }

    if (node.expression.text === "$inject") {
      const fallback = node.arguments[1];

      if (fallback) {
        diagnostics.push(
          ...validateCloneableExpression(
            fallback,
            scriptSourceFile,
            context,
            script.body.range.start,
            "`$inject` fallback must be cloneable data.",
          ),
        );
      }
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
  return diagnostics;
}

function validateCloneableTsIsland(
  island: TsIslandCst,
  context: CloneabilityContext,
  message: string,
): Diagnostic[] {
  const parsed = parseExpressionIsland(island);

  if (!parsed) {
    return [];
  }

  return validateCloneableExpression(parsed.expression, parsed.sourceFile, context, parsed.originalStart, message);
}

function parseExpressionIsland(island: TsIslandCst): {
  sourceFile: ts.SourceFile;
  expression: ts.Expression;
  originalStart: number;
} | undefined {
  if (!island.text) {
    return undefined;
  }

  const prefix = "const __slateValue = (";
  const source = `${prefix}${island.text});`;
  const sourceFile = ts.createSourceFile("template-expression.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const statement = sourceFile.statements[0];

  if (!statement || !ts.isVariableStatement(statement)) {
    return undefined;
  }

  const declaration = statement.declarationList.declarations[0];

  if (!declaration?.initializer) {
    return undefined;
  }

  return {
    sourceFile,
    expression: declaration.initializer,
    originalStart: trimmedIslandRangeStart(island) - prefix.length,
  };
}

function validateCloneableExpression(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
  context: CloneabilityContext,
  originalStart: number,
  message: string,
): Diagnostic[] {
  const invalid = findNonCloneableNode(expression, context);

  if (!invalid) {
    return [];
  }

  return [
    error(message, {
      start: originalStart + invalid.getStart(sourceFile),
      end: originalStart + invalid.getEnd(),
    }),
  ];
}

function findNonCloneableNode(node: ts.Node, context: CloneabilityContext, seen = new Set<string>()): ts.Node | undefined {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) {
    return findNonCloneableNode(node.expression, context, seen);
  }

  if (ts.isIdentifier(node)) {
    if (seen.has(node.text)) {
      return undefined;
    }

    const binding = context.bindings.get(node.text);

    if (!binding) {
      return undefined;
    }

    seen.add(node.text);
    return findNonCloneableBinding(binding, context, seen) ? node : undefined;
  }

  if (
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isClassExpression(node) ||
    ts.isNewExpression(node) ||
    ts.isAwaitExpression(node) ||
    ts.isYieldExpression(node) ||
    ts.isTaggedTemplateExpression(node) ||
    ts.isCallExpression(node)
  ) {
    return node;
  }

  if (node.kind === ts.SyntaxKind.BigIntLiteral) {
    return node;
  }

  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) {
      const invalid = findNonCloneableNode(element, context, seen);

      if (invalid) {
        return invalid;
      }
    }

    return undefined;
  }

  if (ts.isSpreadElement(node)) {
    return findNonCloneableNode(node.expression, context, seen);
  }

  if (ts.isObjectLiteralExpression(node)) {
    for (const property of node.properties) {
      if (ts.isMethodDeclaration(property) || ts.isGetAccessorDeclaration(property) || ts.isSetAccessorDeclaration(property)) {
        return property;
      }

      if (ts.isPropertyAssignment(property)) {
        const invalid = findNonCloneableNode(property.initializer, context, seen);

        if (invalid) {
          return invalid;
        }

        continue;
      }

      if (ts.isShorthandPropertyAssignment(property)) {
        const invalid = findNonCloneableNode(property.name, context, seen);

        if (invalid) {
          return invalid;
        }

        continue;
      }

      if (ts.isSpreadAssignment(property)) {
        const invalid = findNonCloneableNode(property.expression, context, seen);

        if (invalid) {
          return invalid;
        }
      }
    }

    return undefined;
  }

  if (ts.isConditionalExpression(node)) {
    return (
      findNonCloneableNode(node.condition, context, seen) ??
      findNonCloneableNode(node.whenTrue, context, seen) ??
      findNonCloneableNode(node.whenFalse, context, seen)
    );
  }

  if (ts.isBinaryExpression(node)) {
    return findNonCloneableNode(node.left, context, seen) ?? findNonCloneableNode(node.right, context, seen);
  }

  if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
    return findNonCloneableNode(node.operand, context, seen);
  }

  if (ts.isTemplateExpression(node)) {
    for (const span of node.templateSpans) {
      const invalid = findNonCloneableNode(span.expression, context, seen);

      if (invalid) {
        return invalid;
      }
    }
  }

  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    return findNonCloneableNode(node.expression, context, seen);
  }

  return undefined;
}

function findNonCloneableBinding(binding: ts.Node, context: CloneabilityContext, seen: Set<string>): boolean {
  if (ts.isFunctionDeclaration(binding) || ts.isClassDeclaration(binding)) {
    return true;
  }

  if (!ts.isVariableDeclaration(binding) || !binding.initializer) {
    return false;
  }

  if (isCloneableDataRuneCall(binding.initializer)) {
    return false;
  }

  return Boolean(findNonCloneableNode(binding.initializer, context, seen));
}

function isCloneableDataRuneCall(expression: ts.Expression): boolean {
  if (!ts.isCallExpression(expression) || !ts.isIdentifier(expression.expression)) {
    return false;
  }

  return expression.expression.text === "$prop" || expression.expression.text === "$props" || expression.expression.text === "$inject";
}

function trimmedIslandRangeStart(island: TsIslandCst): number {
  return island.range.end - island.text.length;
}
