import type {
  AttributeCst,
  ElementCst,
  EachBlockCst,
  HtmlDirectiveCst,
  IfBlockCst,
  InterpolationCst,
  RawTextElementCst,
  SlateFileCst,
  SlateScriptElementCst,
  TemplateCstNode,
  TextCst,
} from "./cst.ts";
import type { Diagnostic } from "./diagnostics.ts";
import type { SlateModule } from "./analyze.ts";
import { appendInlineSourceMap, createSourceMap, type SourceMap, type SourceMapHint, type SourceMapOption } from "./sourcemap.ts";
import ts from "typescript";

export type GenerateOptions = {
  filename?: string;
  source?: string;
  module?: SlateModule;
  dev?: boolean;
  sourcemap?: SourceMapOption;
};

export type GenerateResult = {
  code: string;
  map?: SourceMap;
  diagnostics: Diagnostic[];
};

export function generate(cst: SlateFileCst, _options: GenerateOptions = {}): GenerateResult {
  const filename = _options.filename ?? "component.slate";
  const dev = _options.dev ?? false;
  const source = _options.source ?? "";
  const sourceMapHints: SourceMapHint[] = [];
  const script = cst.children.find((child): child is SlateScriptElementCst => child.kind === "SlateScriptElement");
  const componentNames = new Set(_options.module?.components.map((component) => component.localName) ?? []);
  const slotBindings = _options.module?.slots ?? [];
  const bodyNodes = cst.children.filter((child) => child.kind !== "SlateScriptElement");
  const scriptParts = script ? transpileSlateScript(script.body.text) : { imports: "", body: "" };
  const statements = generateStatements(bodyNodes, componentNames, "__html", filename, dev, sourceMapHints);
  const usedRunes = collectUsedRunes([scriptParts.body, statements]);
  const kitImports = collectKitImports([scriptParts.body, statements]);
  const runeHelpers = generateRuneHelpers(usedRunes, slotBindings);
  let code = [
    `import { ${kitImports.join(", ")} } from "@slate/kit";`,
    scriptParts.imports.trim(),
    "",
    "export async function render(__props = {}, slots = {}, context = {}) {",
    "  context = cloneContext(context);",
    runeHelpers.length ? indent(runeHelpers.join("\n"), 2) : "",
    scriptParts.body.trim() ? indent(scriptParts.body.trim(), 2) : "",
    "  let __html = \"\";",
    statements ? indent(statements, 2) : "",
    "  return __slateHtml(__html);",
    "}",
    "",
    "export default { render };",
    "",
  ]
    .filter((part) => part !== "")
    .join("\n");
  const map = _options.sourcemap
    ? createSourceMap({
        code,
        source,
        filename,
        hints: sourceMapHints,
      })
    : undefined;

  if (_options.sourcemap === "inline" && map) {
    code = appendInlineSourceMap(code, map);
  }

  return {
    code,
    map,
    diagnostics: [],
  };
}

type RuneName = "$prop" | "$props" | "$provide" | "$inject" | "$slot";

const RUNE_NAMES: RuneName[] = ["$prop", "$props", "$provide", "$inject", "$slot"];

function collectUsedRunes(chunks: string[]): Set<RuneName> {
  const used = new Set<RuneName>();

  for (const chunk of chunks) {
    if (!chunk.trim()) {
      continue;
    }

    const sourceFile = ts.createSourceFile("generated-component.mjs", chunk, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

    function visit(node: ts.Node): void {
      if (ts.isIdentifier(node) && isRuneName(node.text)) {
        used.add(node.text);
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return used;
}

function isRuneName(value: string): value is RuneName {
  return RUNE_NAMES.includes(value as RuneName);
}

function collectKitImports(chunks: string[]): string[] {
  const source = chunks.join("\n");
  const imports = ["cloneContext", "html as __slateHtml"];

  for (const helper of ["evaluateSlateExpression", "renderHTML", "renderSlot", "renderValue", "serializeAttribute", "serializeClass", "serializeStyle"]) {
    if (source.includes(`${helper}(`) || (helper === "renderSlot" && source.includes("$slot"))) {
      imports.push(helper);
    }
  }

  if (source.includes("addGlobalAsset(")) {
    imports.push("addGlobalAsset");
  }

  if (source.includes("__slateJsx(")) {
    imports.push("jsx as __slateJsx");
  }

  if (source.includes("__slateFragment")) {
    imports.push("Fragment as __slateFragment");
  }

  return imports;
}

function generateRuneHelpers(usedRunes: Set<RuneName>, slots: SlateModule["slots"]): string[] {
  const helpers: string[] = [];

  if (usedRunes.has("$prop")) {
    helpers.push("const $prop = (name, defaultValue) => Object.hasOwn(__props, name) ? __props[name] : defaultValue;");
  }

  if (usedRunes.has("$props")) {
    helpers.push("const $props = (defaults = {}) => ({ ...defaults, ...__props });");
  }

  if (usedRunes.has("$provide")) {
    helpers.push("const $provide = (name, value) => { context.provides[name] = value; };");
  }

  if (usedRunes.has("$inject")) {
    helpers.push("const $inject = (name, fallback) => Object.hasOwn(context.provides, name) ? context.provides[name] : fallback;");
  }

  if (usedRunes.has("$slot")) {
    const knownSlots = new Map(slots.map((slot) => [slot.name, slot.defaultData]));
    const defaults = [...knownSlots].map(([name, defaultData]) => `${JSON.stringify(name)}: ${defaultData ?? "undefined"}`);
    helpers.push(`const __slotDefaults = { ${defaults.join(", ")} };`);
    helpers.push("const $slot = (name, defaultData = __slotDefaults[name]) => (data = defaultData) => renderSlot(slots, name, __slateHtml(\"\"), data);");
  }

  return helpers;
}

function generateStatements(
  nodes: TemplateCstNode[],
  componentNames: Set<string>,
  target: string,
  filename: string,
  dev: boolean,
  sourceMapHints: SourceMapHint[],
): string {
  return nodes.map((node) => generateStatement(node, componentNames, target, filename, dev, sourceMapHints)).filter(Boolean).join("\n");
}

function generateStatement(
  node: TemplateCstNode,
  componentNames: Set<string>,
  target: string,
  filename: string,
  dev: boolean,
  sourceMapHints: SourceMapHint[],
): string {
  switch (node.kind) {
    case "ConstTag":
    case "LetTag":
      return `${node.statement.text};`;
    case "IfBlock":
      return generateIfStatement(node, componentNames, target, filename, dev, sourceMapHints);
    case "EachBlock":
      return generateEachStatement(node, componentNames, target, filename, dev, sourceMapHints);
    case "DebugDirective":
    case "Error":
    case "SlateScriptElement":
      return "";
    default:
      return `${target} += ${generateNode(node, componentNames, filename, dev, sourceMapHints)};`;
  }
}

function generateNode(
  node: TemplateCstNode,
  componentNames: Set<string>,
  filename: string,
  dev: boolean,
  sourceMapHints: SourceMapHint[],
): string {
  switch (node.kind) {
    case "Text":
      return generateText(node);
    case "Comment":
      return JSON.stringify(`<!--${node.text}${node.closed ? "-->" : ""}`);
    case "Element":
      return generateElement(node, componentNames, filename, dev, sourceMapHints);
    case "RawTextElement":
      return generateRawTextElement(node, filename, sourceMapHints);
    case "Interpolation":
      return generateInterpolation(node, filename, sourceMapHints);
    case "HtmlDirective":
      return generateHtmlDirective(node, filename, sourceMapHints);
    case "IfBlock":
      return generateIfBlock(node, componentNames, filename, dev, sourceMapHints);
    case "EachBlock":
      return generateEachBlock(node, componentNames, filename, dev, sourceMapHints);
    case "ConstTag":
    case "LetTag":
      return "\"\"";
    case "DebugDirective":
    case "Error":
    case "SlateScriptElement":
      return "";
  }
}

function generateIfStatement(node: IfBlockCst, componentNames: Set<string>, target: string, filename: string, dev: boolean, sourceMapHints: SourceMapHint[]): string {
  const condition = node.open.expression ? wrapExpression(node.open.expression.text, filename, node.open.expression.range, "template", sourceMapHints) : "false";
  const thenBody = generateStatements(node.then, componentNames, target, filename, dev, sourceMapHints);
  const elseBody = node.else ? generateStatements(node.else, componentNames, target, filename, dev, sourceMapHints) : "";

  if (!node.else) {
    return `if (${condition}) {\n${indent(thenBody, 2)}\n}`;
  }

  return `if (${condition}) {\n${indent(thenBody, 2)}\n} else {\n${indent(elseBody, 2)}\n}`;
}

function generateEachStatement(node: EachBlockCst, componentNames: Set<string>, target: string, filename: string, dev: boolean, sourceMapHints: SourceMapHint[]): string {
  const list = `Array.from(${wrapExpression(node.expression.text, filename, node.expression.range, "template", sourceMapHints)})`;
  const item = node.item;
  const body = generateStatements(node.children, componentNames, target, filename, dev, sourceMapHints);
  const elseBody = node.else ? generateStatements(node.else, componentNames, target, filename, dev, sourceMapHints) : "";
  const entry = node.index ? `${node.index}, ${item}` : `_, ${item}`;

  if (!node.else) {
    return `for (const [${entry}] of ${list}.entries()) {\n${indent(body, 2)}\n}`;
  }

  return `const __items = ${list};\nif (__items.length) {\n  for (const [${entry}] of __items.entries()) {\n${indent(body, 4)}\n  }\n} else {\n${indent(elseBody, 2)}\n}`;
}

function generateEachBlock(node: EachBlockCst, componentNames: Set<string>, filename: string, dev: boolean, sourceMapHints: SourceMapHint[]): string {
  const item = node.item;
  const index = node.index ? `, ${node.index}` : "";
  const body = node.children.map((child) => generateNode(child, componentNames, filename, dev, sourceMapHints)).filter(Boolean).join(",\n          ");
  const elseBody = node.else?.map((child) => generateNode(child, componentNames, filename, dev, sourceMapHints)).filter(Boolean).join(",\n        ");
  const eachExpression = `Array.from(${wrapExpression(node.expression.text, filename, node.expression.range, "template", sourceMapHints)})`;

  if (!node.else) {
    return `(await Promise.all(${eachExpression}.map(async (${item}${index}) => {\n          return [\n            ${body}\n          ].join(\"\");\n        }))).join("")`;
  }

  return `await (async () => {\n        const __items = ${eachExpression};\n        return __items.length ? (await Promise.all(__items.map(async (${item}${index}) => {\n          return [\n            ${body}\n          ].join(\"\");\n        }))).join("") : [\n        ${elseBody ?? ""}\n      ].join("");\n      })()`;
}

function generateIfBlock(node: IfBlockCst, componentNames: Set<string>, filename: string, dev: boolean, sourceMapHints: SourceMapHint[]): string {
  const condition = node.open.expression ? wrapExpression(node.open.expression.text, filename, node.open.expression.range, "template", sourceMapHints) : "false";
  const thenBody = node.then.map((child) => generateNode(child, componentNames, filename, dev, sourceMapHints)).filter(Boolean).join(",\n        ");
  const elseBody = node.else?.map((child) => generateNode(child, componentNames, filename, dev, sourceMapHints)).filter(Boolean).join(",\n        ");

  return `(${condition}) ? [\n        ${thenBody}\n      ].join("") : [\n        ${elseBody ?? ""}\n      ].join("")`;
}

function generateText(node: TextCst): string {
  return JSON.stringify(node.text);
}

function generateInterpolation(node: InterpolationCst, filename: string, sourceMapHints: SourceMapHint[]): string {
  return `await renderValue(${wrapExpression(node.expression.text, filename, node.expression.range, "template", sourceMapHints)})`;
}

function generateHtmlDirective(node: HtmlDirectiveCst, filename: string, sourceMapHints: SourceMapHint[]): string {
  return `await renderHTML(${wrapExpression(node.expression.text, filename, node.expression.range, "template", sourceMapHints)})`;
}

function generateElement(node: ElementCst, componentNames: Set<string>, filename: string, dev: boolean, sourceMapHints: SourceMapHint[]): string {
  if (componentNames.has(node.rawTagName)) {
    return generateComponent(node, filename, dev, componentNames, sourceMapHints);
  }

  if (node.tagName === "slot") {
    return generateSlotOutlet(node, componentNames, filename, dev, sourceMapHints);
  }

  if (node.rawTagName === "Fragment") {
    return [
      "[",
      ...node.children.map((child) => generateNode(child, componentNames, filename, dev, sourceMapHints)).filter(Boolean).map((child) => `  ${child},`),
      "].join(\"\")",
    ].join("\n");
  }

  if (node.selfClosing) {
    return `[${generateOpenTagParts(node.rawTagName, node.openTag.attributes, true, filename, dev, sourceMapHints).join(", ")}].join("")`;
  }

  const children = node.children.map((child) => generateNode(child, componentNames, filename, dev, sourceMapHints)).filter(Boolean);
  const close = node.closeTag ? `</${node.closeTag.rawTagName}>` : "";

  return [
    "[",
    ...generateOpenTagParts(node.rawTagName, node.openTag.attributes, false, filename, dev, sourceMapHints).map((part) => `  ${part},`),
    ...children.map((child) => `  ${child},`),
    `  ${JSON.stringify(close)}`,
    "].join(\"\")",
  ].join("\n");
}

function generateOpenTagParts(rawTagName: string, attributes: AttributeCst[], selfClosing: boolean, filename: string, dev: boolean, sourceMapHints: SourceMapHint[]): string[] {
  return [
    JSON.stringify(`<${rawTagName}`),
    ...generateAttributeParts(attributes, filename, dev, sourceMapHints),
    JSON.stringify(selfClosing ? " />" : ">"),
  ];
}

function generateAttributeParts(attributes: AttributeCst[], filename: string, dev: boolean, sourceMapHints: SourceMapHint[]): string[] {
  const chunks: string[] = [];

  for (const attr of attributes) {
    if (attr.kind === "DirectiveAttribute" && attr.namespace === "dev") {
      if (dev && attr.directiveName === "scroll" && attr.valueKind === "string" && typeof attr.value === "string") {
        chunks.push(JSON.stringify(` data-slate-dev-scroll="${escapeAttributeLiteral(attr.value)}"`));
      }
      continue;
    }

    if (attr.kind === "BooleanAttribute") {
      chunks.push(JSON.stringify(` ${attr.rawName}`));
      continue;
    }

    if (attr.kind === "StringAttribute") {
      chunks.push(JSON.stringify(` ${attr.rawName}=${attr.quote}${escapeAttributeLiteral(attr.value)}${attr.quote}`));
      continue;
    }

    if (attr.kind === "ExpressionAttribute") {
      const expression = wrapExpression(attr.expression.text, filename, attr.expression.range, "template", sourceMapHints);
      let value = expression;

      if (attr.name === "class") {
        value = `serializeClass(${expression})`;
      } else if (attr.name === "style") {
        value = `serializeStyle(${expression})`;
      }

      chunks.push(`serializeAttribute(${JSON.stringify(attr.rawName)}, ${value})`);
      continue;
    }

    if (attr.kind === "DirectiveAttribute") {
      continue;
    }
  }

  return chunks;
}

function generateJoined(children: string[]): string {
  return [
    "[",
    ...children,
    "].join(\"\")",
  ].join("\n");
}

function generateSlotOutlet(node: ElementCst, componentNames: Set<string>, filename: string, dev: boolean, sourceMapHints: SourceMapHint[]): string {
  const nameAttr = node.openTag.attributes.find(
    (attr) => attr.kind === "StringAttribute" && attr.name === "name",
  );
  const dataAttr = node.openTag.attributes.find(
    (attr) => attr.kind === "ExpressionAttribute" && attr.name === "data",
  );
  const name = nameAttr?.kind === "StringAttribute" ? nameAttr.value : "default";
  const fallback = node.children.length
    ? `[\n      ${node.children.map((child) => generateNode(child, componentNames, filename, dev, sourceMapHints)).filter(Boolean).join(",\n      ")}\n    ].join("")`
    : "\"\"";
  const data = dataAttr?.kind === "ExpressionAttribute"
    ? wrapExpression(dataAttr.expression.text, filename, dataAttr.expression.range, "slot", sourceMapHints)
    : "undefined";

  return `await renderHTML(await renderSlot(slots, ${JSON.stringify(name)}, __slateHtml(${fallback}), ${data}))`;
}

function generateComponent(node: ElementCst, filename: string, dev: boolean, componentNames: Set<string>, sourceMapHints: SourceMapHint[]): string {
  return `await renderHTML(await ${node.rawTagName}.render(${generatePropsObject(node.openTag.attributes, filename, sourceMapHints)}, ${generateSlotsObject(node, componentNames, filename, dev, sourceMapHints)}, context))`;
}

function generateSlotsObject(node: ElementCst, componentNames: Set<string>, filename: string, dev: boolean, sourceMapHints: SourceMapHint[]): string {
  const slotGroups = new Map<string, { pattern?: string; children: TemplateCstNode[] }>();
  slotGroups.set("default", {
    children: [],
  });

  for (const child of node.children) {
    if (child.kind !== "Element") {
      slotGroups.get("default")!.children.push(child);
      continue;
    }

    const slotAttr = child.openTag.attributes.find(
      (attr) => attr.kind === "DirectiveAttribute" && attr.namespace === "slot",
    );

    if (!slotAttr || slotAttr.kind !== "DirectiveAttribute") {
      slotGroups.get("default")!.children.push(child);
      continue;
    }

    const slotName = slotAttr.directiveName || "default";
    const existing = slotGroups.get(slotName) ?? {
      children: [],
    };

    if (slotAttr.valueKind === "expression" && typeof slotAttr.value === "object") {
      existing.pattern = slotAttr.value.text;
    }

    existing.children.push(stripSlotAttribute(child));
    slotGroups.set(slotName, existing);
  }

  const entries = [...slotGroups.entries()].filter(([, slot]) => slot.children.length > 0);

  if (entries.length === 0) {
    return "{}";
  }

  const slots = entries.map(([name, slot]) => {
    const params = slot.pattern ? slot.pattern : "";

    return `${JSON.stringify(name)}: async (${params}) => {\n      let __html = \"\";\n${indent(generateStatements(slot.children, componentNames, "__html", filename, dev, sourceMapHints), 6)}\n      return __slateHtml(__html);\n    }`;
  });

  return `{\n    ${slots.join(",\n    ")}\n  }`;
}

function stripSlotAttribute(node: ElementCst): ElementCst {
  return {
    ...node,
    openTag: {
      ...node.openTag,
      attributes: node.openTag.attributes.filter(
        (attr) => !(attr.kind === "DirectiveAttribute" && attr.namespace === "slot"),
      ),
    },
  };
}

function generatePropsObject(attributes: AttributeCst[], filename: string, sourceMapHints: SourceMapHint[]): string {
  const props: string[] = [];

  for (const attr of attributes) {
    if (attr.kind === "BooleanAttribute") {
      props.push(`${JSON.stringify(attr.name)}: true`);
      continue;
    }

    if (attr.kind === "StringAttribute") {
      props.push(`${JSON.stringify(attr.name)}: ${JSON.stringify(attr.value)}`);
      continue;
    }

    if (attr.kind === "ExpressionAttribute") {
      props.push(`${JSON.stringify(attr.name)}: ${wrapExpression(attr.expression.text, filename, attr.expression.range, "component", sourceMapHints)}`);
      continue;
    }
  }

  return `{ ${props.join(", ")} }`;
}

function generateRawTextElement(node: RawTextElementCst, filename: string, sourceMapHints: SourceMapHint[]): string {
  const close = node.closeTag ? `</${node.closeTag.rawTagName}>` : "";
  const html = generateJoined([
    ...generateOpenTagParts(node.rawTagName, node.openTag.attributes, false, filename, false, sourceMapHints).map((part) => `  ${part},`),
    `  ${JSON.stringify(node.body.text)},`,
    `  ${JSON.stringify(close)}`,
  ]);
  const position = globalAssetPosition(node);

  if (position) {
    return `addGlobalAsset(context, ${JSON.stringify(position)}, ${html})`;
  }

  return html;
}

function globalAssetPosition(node: RawTextElementCst): "head" | "tail" | undefined {
  const globalAttr = node.openTag.attributes.find(
    (attr): attr is Extract<AttributeCst, { kind: "DirectiveAttribute" }> =>
      attr.kind === "DirectiveAttribute" &&
      attr.namespace === "is" &&
      attr.directiveName === "global",
  );

  if (!globalAttr) {
    return undefined;
  }

  if (node.tagName === "style") {
    return "head";
  }

  if (globalAttr.valueKind === "string" && globalAttr.value === "head") {
    return "head";
  }

  return "tail";
}

function escapeAttributeLiteral(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;");
}

function wrapExpression(
  text: string,
  filename: string,
  range: { start: number; end: number },
  kind: "script" | "template" | "slot" | "component",
  sourceMapHints: SourceMapHint[],
): string {
  sourceMapHints.push({
    generatedText: text,
    original: range,
  });
  return `evaluateSlateExpression(() => (${text}), ${sourceLocation(filename, range, kind)})`;
}

function sourceLocation(
  filename: string,
  range: { start: number; end: number },
  kind: "script" | "template" | "slot" | "component",
): string {
  return JSON.stringify({
    filename,
    range,
    kind,
  });
}

function indent(text: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line ? `${prefix}${line}` : line))
    .join("\n");
}

function transpileSlateScript(text: string): { imports: string; body: string } {
  const { imports, body } = splitSlateScript(text);
  const importResult = ts.transpileModule(imports, {
    fileName: "component.slate.tsx",
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      jsxFactory: "__slateJsx",
      jsxFragmentFactory: "__slateFragment",
      removeComments: false,
      verbatimModuleSyntax: true,
    },
  });
  const result = ts.transpileModule(body, {
    fileName: "component.slate.tsx",
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      jsxFactory: "__slateJsx",
      jsxFragmentFactory: "__slateFragment",
      removeComments: false,
    },
  });

  return {
    imports: importResult.outputText.replace(/\n?export \{\};\s*$/m, "").trim(),
    body: result.outputText.replace(/\n?export \{\};\s*$/m, ""),
  };
}

function splitSlateScript(text: string): { imports: string; body: string } {
  const sourceFile = createSlateScriptSourceFile(text);
  const imports: string[] = [];
  const removals: Array<[number, number]> = [];

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const runtimeImport = runtimeImportText(statement);

      if (runtimeImport) {
        imports.push(runtimeImport);
      }

      removals.push([statement.getFullStart(), statement.getEnd()]);
      continue;
    }

    if (
      ts.isTypeAliasDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      (ts.isExportDeclaration(statement) && statement.isTypeOnly)
    ) {
      removals.push([statement.getFullStart(), statement.getEnd()]);
    }
  }

  let body = text;

  for (const [start, end] of removals.sort((a, b) => b[0] - a[0])) {
    body = `${body.slice(0, start)}${body.slice(end)}`;
  }

  return {
    imports: imports.join("\n"),
    body,
  };
}

function runtimeImportText(statement: ts.ImportDeclaration): string | undefined {
  const moduleSpecifier = ts.isStringLiteralLike(statement.moduleSpecifier)
    ? JSON.stringify(statement.moduleSpecifier.text)
    : statement.moduleSpecifier.getText();
  const clause = statement.importClause;

  if (!clause) {
    return `import ${moduleSpecifier};`;
  }

  if (clause.isTypeOnly) {
    return undefined;
  }

  const defaultImport = clause.name?.text;
  const bindings = clause.namedBindings ? runtimeNamedBindingsText(clause.namedBindings) : undefined;

  if (defaultImport && bindings) {
    return `import ${defaultImport}, ${bindings} from ${moduleSpecifier};`;
  }

  if (defaultImport) {
    return `import ${defaultImport} from ${moduleSpecifier};`;
  }

  if (bindings) {
    return `import ${bindings} from ${moduleSpecifier};`;
  }

  return undefined;
}

function runtimeNamedBindingsText(bindings: ts.NamedImportBindings): string | undefined {
  if (ts.isNamespaceImport(bindings)) {
    return `* as ${bindings.name.text}`;
  }

  const elements = bindings.elements
    .filter((element) => !element.isTypeOnly)
    .map((element) => {
      if (element.propertyName) {
        return `${element.propertyName.text} as ${element.name.text}`;
      }

      return element.name.text;
    });

  return elements.length ? `{ ${elements.join(", ")} }` : undefined;
}

function stripTypeOnlyExports(text: string): string {
  const sourceFile = createSlateScriptSourceFile(text);
  const removals: Array<[number, number]> = [];

  for (const statement of sourceFile.statements) {
    if (
      ts.isTypeAliasDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      (ts.isExportDeclaration(statement) && statement.isTypeOnly)
    ) {
      removals.push([statement.getFullStart(), statement.getEnd()]);
    }
  }

  let output = text;

  for (const [start, end] of removals.sort((a, b) => b[0] - a[0])) {
    output = `${output.slice(0, start)}${output.slice(end)}`;
  }

  return output;
}

function createSlateScriptSourceFile(text: string): ts.SourceFile {
  return ts.createSourceFile("component.slate.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
