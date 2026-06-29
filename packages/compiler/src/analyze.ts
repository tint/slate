import type {
  AttributeCst,
  ElementCst,
  RawTextElementCst,
  SlateFileCst,
  SlateScriptElementCst,
  TemplateCstNode,
} from "./cst.ts";
import { error, type Diagnostic } from "./diagnostics.ts";
import type { Range } from "./source.ts";
import ts from "typescript";

export type AnalyzeOptions = {
  filename?: string;
};

export type ComponentBinding = {
  localName: string;
  source: string;
  range: Range;
};

export type SlotBinding = {
  localName: string;
  name: string;
  defaultData?: string;
  range: Range;
};

type TemplateSlotOutlet = {
  name: string;
  range: Range;
};

export type SlateModule = {
  script?: SlateScriptElementCst;
  components: ComponentBinding[];
  slots: SlotBinding[];
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
  const slots = script ? collectSlotBindings(script, diagnostics) : [];
  diagnostics.push(...validateSlotRuneOutletConflicts(cst, slots));
  const module: SlateModule = {
    script,
    components,
    slots,
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

    if (attr.kind === "DirectiveAttribute" && attr.namespace === "dev") {
      diagnostics.push(error("`dev:*` directives are not allowed on <script slate>.", attr.range));
    }
  }

  diagnostics.push(...validateTypeOnlyExports(script));
  diagnostics.push(...validateRuneConflicts(script));

  return diagnostics;
}

function validateTypeOnlyExports(script: SlateScriptElementCst): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const text = script.body.text;
  const bodyStart = script.body.range.start;
  const sourceFile = createSlateScriptSourceFile(text);

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
  const sourceFile = createSlateScriptSourceFile(text);

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

function collectSlotBindings(script: SlateScriptElementCst, diagnostics: Diagnostic[]): SlotBinding[] {
  const slots: SlotBinding[] = [];
  const text = script.body.text;
  const bodyStart = script.body.range.start;
  const sourceFile = createSlateScriptSourceFile(text);

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;

    for (const declaration of statement.declarationList.declarations) {
      if (!declaration.initializer || !ts.isCallExpression(declaration.initializer)) {
        continue;
      }

      const call = declaration.initializer;

      if (!ts.isIdentifier(call.expression) || call.expression.text !== "$slot") {
        continue;
      }

      if (!isConst || !ts.isIdentifier(declaration.name)) {
        diagnostics.push(error("`$slot` must be assigned to a top-level const identifier.", {
          start: bodyStart + declaration.getStart(sourceFile),
          end: bodyStart + declaration.getEnd(),
        }));
        continue;
      }

      const nameArg = call.arguments[0];

      if (!nameArg || !ts.isStringLiteralLike(nameArg)) {
        diagnostics.push(error("`$slot` requires a static string slot name.", {
          start: bodyStart + call.getStart(sourceFile),
          end: bodyStart + call.getEnd(),
        }));
        continue;
      }

      if (!nameArg.text) {
        diagnostics.push(error("`$slot` name must not be empty.", {
          start: bodyStart + nameArg.getStart(sourceFile),
          end: bodyStart + nameArg.getEnd(),
        }));
        continue;
      }

      const defaultData = call.arguments[1];

      slots.push({
        localName: declaration.name.text,
        name: nameArg.text,
        defaultData: defaultData ? text.slice(defaultData.getStart(sourceFile), defaultData.getEnd()) : undefined,
        range: {
          start: bodyStart + declaration.getStart(sourceFile),
          end: bodyStart + declaration.getEnd(),
        },
      });
    }
  }

  return slots;
}

function validateSlotRuneOutletConflicts(cst: SlateFileCst, slots: SlotBinding[]): Diagnostic[] {
  if (!slots.length) {
    return [];
  }

  const diagnostics: Diagnostic[] = [];
  const slotRuneNames = new Map(slots.map((slot) => [slot.name, slot]));

  for (const outlet of collectTemplateSlotOutlets(cst.children)) {
    const rune = slotRuneNames.get(outlet.name);

    if (!rune) {
      continue;
    }

    diagnostics.push(error(
      `Slot \`${outlet.name}\` is already consumed by $slot. Use either $slot or <slot> for the same slot name.`,
      outlet.range,
    ));
  }

  return diagnostics;
}

function collectTemplateSlotOutlets(nodes: TemplateCstNode[], outlets: TemplateSlotOutlet[] = []): TemplateSlotOutlet[] {
  for (const node of nodes) {
    if (node.kind === "Element") {
      if (node.tagName === "slot") {
        outlets.push({
          name: templateSlotOutletName(node),
          range: node.openTag.range,
        });
      }

      collectTemplateSlotOutlets(node.children, outlets);
      continue;
    }

    if (node.kind === "IfBlock") {
      collectTemplateSlotOutlets(node.then, outlets);

      if (node.else) {
        collectTemplateSlotOutlets(node.else, outlets);
      }

      continue;
    }

    if (node.kind === "EachBlock") {
      collectTemplateSlotOutlets(node.children, outlets);

      if (node.else) {
        collectTemplateSlotOutlets(node.else, outlets);
      }
      continue;
    }

    if (node.kind === "AwaitBlock") {
      collectTemplateSlotOutlets(node.pending, outlets);
      collectTemplateSlotOutlets(node.then?.children ?? [], outlets);
      collectTemplateSlotOutlets(node.catch?.children ?? [], outlets);
    }
  }

  return outlets;
}

function templateSlotOutletName(element: ElementCst): string {
  const nameAttribute = element.openTag.attributes.find((attribute) => attribute.name === "name");
  return nameAttribute?.kind === "StringAttribute" && nameAttribute.value ? nameAttribute.value : "default";
}

type RuneDeclaration = {
  name: string;
  rune: "$prop" | "$props" | "$slot";
  range: Range;
};

function validateRuneConflicts(script: SlateScriptElementCst): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const text = script.body.text;
  const bodyStart = script.body.range.start;
  const sourceFile = createSlateScriptSourceFile(text);
  const propDeclarations: RuneDeclaration[] = [];
  const slotDeclarations: RuneDeclaration[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!declaration.initializer || !ts.isCallExpression(declaration.initializer)) {
        continue;
      }

      const call = declaration.initializer;

      if (!ts.isIdentifier(call.expression)) {
        continue;
      }

      if (call.expression.text === "$prop") {
        if (isUndefinedTypeArgument(call)) {
          diagnostics.push(error(
            "`$prop<undefined>` is not meaningful. Use a real value type, or a union such as `T | undefined` for optional props.",
            absoluteRange(bodyStart, call.typeArguments![0]!, sourceFile),
          ));
        }

        const propName = staticStringArgument(call, 0);

        if (propName) {
          propDeclarations.push({
            name: propName,
            rune: "$prop",
            range: absoluteRange(bodyStart, call.arguments[0]!, sourceFile),
          });
        }

        continue;
      }

      if (call.expression.text === "$props") {
        for (const propName of uniqueStaticPropsKeys(call, sourceFile)) {
          propDeclarations.push({
            name: propName.name,
            rune: "$props",
            range: {
              start: bodyStart + propName.start,
              end: bodyStart + propName.end,
            },
          });
        }

        continue;
      }

      if (call.expression.text === "$slot") {
        const slotName = staticStringArgument(call, 0);

        if (slotName) {
          slotDeclarations.push({
            name: slotName,
            rune: "$slot",
            range: absoluteRange(bodyStart, call.arguments[0]!, sourceFile),
          });
        }
      }
    }
  }

  diagnostics.push(...duplicateRuneDiagnostics(propDeclarations, "prop"));
  diagnostics.push(...duplicateRuneDiagnostics(slotDeclarations, "slot"));
  return diagnostics;
}

function duplicateRuneDiagnostics(declarations: RuneDeclaration[], label: "prop" | "slot"): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const firstByName = new Map<string, RuneDeclaration>();

  for (const declaration of declarations) {
    const first = firstByName.get(declaration.name);

    if (!first) {
      firstByName.set(declaration.name, declaration);
      continue;
    }

    diagnostics.push(error(
      `Duplicate ${label} rune declaration for \`${declaration.name}\`. First declared with ${first.rune}.`,
      declaration.range,
    ));
  }

  return diagnostics;
}

function staticStringArgument(call: ts.CallExpression, index: number): string | undefined {
  const argument = call.arguments[index];
  return argument && ts.isStringLiteralLike(argument) ? argument.text : undefined;
}

function isUndefinedTypeArgument(call: ts.CallExpression): boolean {
  return call.typeArguments?.[0]?.kind === ts.SyntaxKind.UndefinedKeyword;
}

function createSlateScriptSourceFile(text: string): ts.SourceFile {
  return ts.createSourceFile("component.slate.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function uniqueStaticPropsKeys(
  call: ts.CallExpression,
  sourceFile: ts.SourceFile,
): Array<{ name: string; start: number; end: number }> {
  const unique = new Map<string, { name: string; start: number; end: number }>();

  for (const key of staticPropsKeys(call, sourceFile)) {
    unique.set(key.name, unique.get(key.name) ?? key);
  }

  return Array.from(unique.values());
}

function staticPropsKeys(
  call: ts.CallExpression,
  sourceFile: ts.SourceFile,
): Array<{ name: string; start: number; end: number }> {
  const keys: Array<{ name: string; start: number; end: number }> = [];
  const typeArgument = call.typeArguments?.[0];

  if (typeArgument && ts.isTypeLiteralNode(typeArgument)) {
    for (const member of typeArgument.members) {
      if (!ts.isPropertySignature(member)) {
        continue;
      }

      const name = propertyNameText(member.name);

      if (!name) {
        continue;
      }

      keys.push({
        name,
        start: member.name.getStart(sourceFile),
        end: member.name.getEnd(),
      });
    }
  }

  const defaults = call.arguments[0];
  const object = defaults ? unwrapTsExpression(defaults) : undefined;

  if (object && ts.isObjectLiteralExpression(object)) {
    for (const property of object.properties) {
      if (ts.isShorthandPropertyAssignment(property)) {
        keys.push({
          name: property.name.text,
          start: property.name.getStart(sourceFile),
          end: property.name.getEnd(),
        });
        continue;
      }

      if (ts.isPropertyAssignment(property)) {
        const name = propertyNameText(property.name);

        if (name) {
          keys.push({
            name,
            start: property.name.getStart(sourceFile),
            end: property.name.getEnd(),
          });
        }
      }
    }
  }

  return keys;
}

function propertyNameText(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return undefined;
}

function unwrapTsExpression(expression: ts.Expression): ts.Expression {
  let current = expression;

  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression(current)) {
    current = current.expression;
  }

  return current;
}

function absoluteRange(bodyStart: number, node: ts.Node, sourceFile: ts.SourceFile): Range {
  return {
    start: bodyStart + node.getStart(sourceFile),
    end: bodyStart + node.getEnd(),
  };
}

function hasExportModifier(statement: ts.Statement): boolean {
  return Boolean(
    ts.canHaveModifiers(statement) &&
      ts.getModifiers(statement)?.some((modifier: ts.ModifierLike) => modifier.kind === ts.SyntaxKind.ExportKeyword),
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

  if (node.kind === "AwaitBlock") {
    for (const child of node.pending) {
      diagnostics.push(...validateTemplateNode(child));
    }

    for (const child of node.then?.children ?? []) {
      diagnostics.push(...validateTemplateNode(child));
    }

    for (const child of node.catch?.children ?? []) {
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

  for (const attr of element.openTag.attributes) {
    if (attr.kind === "DirectiveAttribute" && attr.namespace === "dev") {
      diagnostics.push(error("`dev:*` directives are only allowed on normal template elements.", attr.range));
    }
  }

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
  const diagnostics: Diagnostic[] = validateDevDirectives(attributes);

  for (const attr of attributes) {
    if (
      attr.kind === "ExpressionAttribute" &&
      attr.name === "style" &&
      looksLikeUnwrappedStyleObject(attr.expression.text)
    ) {
      diagnostics.push(error("Style object expressions must use double braces, for example `style={{ color: \"red\" }}`.", attr.range));
      continue;
    }

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

function looksLikeUnwrappedStyleObject(expression: string): boolean {
  const trimmed = expression.trim();
  return /^[A-Za-z_$][\w$-]*\s*:/.test(trimmed);
}

function validateDevDirectives(attributes: AttributeCst[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const attr of attributes) {
    if (attr.kind !== "DirectiveAttribute" || attr.namespace !== "dev") {
      continue;
    }

    if (attr.directiveName !== "scroll") {
      diagnostics.push(error("Unknown `dev:*` directive. Only `dev:scroll` is supported.", attr.range));
      continue;
    }

    if (attr.valueKind !== "string") {
      diagnostics.push(error("`dev:scroll` must use a stable static string value.", attr.range));
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
