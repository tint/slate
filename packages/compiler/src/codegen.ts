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
} from "./cst";
import type { Diagnostic } from "./diagnostics";
import type { SlateModule } from "./analyze";
import ts from "typescript";

export type GenerateOptions = {
  filename?: string;
  module?: SlateModule;
};

export type GenerateResult = {
  code: string;
  diagnostics: Diagnostic[];
};

export function generate(cst: SlateFileCst, _options: GenerateOptions = {}): GenerateResult {
  const filename = _options.filename ?? "component.slate";
  const script = cst.children.find((child): child is SlateScriptElementCst => child.kind === "SlateScriptElement");
  const componentNames = new Set(_options.module?.components.map((component) => component.localName) ?? []);
  const bodyNodes = cst.children.filter((child) => child.kind !== "SlateScriptElement");
  const scriptParts = script ? transpileSlateScript(script.body.text) : { imports: "", body: "" };
  const statements = generateStatements(bodyNodes, componentNames, "__html", filename);
  const usedRunes = collectUsedRunes([scriptParts.body, statements]);
  const kitImports = collectKitImports(statements, usedRunes);
  const runeHelpers = generateRuneHelpers(usedRunes);
  const code = [
    `import { ${kitImports.join(", ")} } from "@slate/kit";`,
    scriptParts.imports.trim(),
    "",
    "export async function render(__props = {}, slots = {}, context = {}) {",
    "  context = cloneContext(context);",
    runeHelpers.length ? indent(runeHelpers.join("\n"), 2) : "",
    scriptParts.body.trim() ? indent(scriptParts.body.trim(), 2) : "",
    "  let __html = \"\";",
    statements ? indent(statements, 2) : "",
    "  return __html;",
    "}",
    "",
    "export default { render };",
    "",
  ]
    .filter((part) => part !== "")
    .join("\n");

  return {
    code,
    diagnostics: [],
  };
}

type RuneName = "$prop" | "$props" | "$provide" | "$inject";

const RUNE_NAMES: RuneName[] = ["$prop", "$props", "$provide", "$inject"];

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

function collectKitImports(statements: string, usedRunes: Set<RuneName>): string[] {
  const imports = ["cloneContext"];

  if (usedRunes.has("$provide") || usedRunes.has("$inject")) {
    imports.push("cloneData");
  }

  for (const helper of ["escapeHTML", "evaluateSlateExpression", "renderSlot", "serializeClass", "serializeStyle"]) {
    if (statements.includes(`${helper}(`)) {
      imports.push(helper);
    }
  }

  if (statements.includes("addGlobalAsset(")) {
    imports.push("addGlobalAsset");
  }

  return imports;
}

function generateRuneHelpers(usedRunes: Set<RuneName>): string[] {
  const helpers: string[] = [];

  if (usedRunes.has("$prop")) {
    helpers.push("const $prop = (name, defaultValue) => Object.hasOwn(__props, name) ? __props[name] : defaultValue;");
  }

  if (usedRunes.has("$props")) {
    helpers.push("const $props = (defaults = {}) => ({ ...defaults, ...__props });");
  }

  if (usedRunes.has("$provide")) {
    helpers.push("const $provide = (name, value) => { context.provides[name] = cloneData(value); };");
  }

  if (usedRunes.has("$inject")) {
    helpers.push("const $inject = (name, fallback) => Object.hasOwn(context.provides, name) ? cloneData(context.provides[name]) : cloneData(fallback);");
  }

  return helpers;
}

function generateStatements(nodes: TemplateCstNode[], componentNames: Set<string>, target: string, filename: string): string {
  return nodes.map((node) => generateStatement(node, componentNames, target, filename)).filter(Boolean).join("\n");
}

function generateStatement(node: TemplateCstNode, componentNames: Set<string>, target: string, filename: string): string {
  switch (node.kind) {
    case "ConstTag":
    case "LetTag":
      return `${node.statement.text};`;
    case "IfBlock":
      return generateIfStatement(node, componentNames, target, filename);
    case "EachBlock":
      return generateEachStatement(node, componentNames, target, filename);
    case "DebugDirective":
    case "Error":
    case "SlateScriptElement":
      return "";
    default:
      return `${target} += ${generateNode(node, componentNames, filename)};`;
  }
}

function generateNode(node: TemplateCstNode, componentNames: Set<string>, filename: string): string {
  switch (node.kind) {
    case "Text":
      return generateText(node);
    case "Comment":
      return JSON.stringify(`<!--${node.text}${node.closed ? "-->" : ""}`);
    case "Element":
      return generateElement(node, componentNames, filename);
    case "RawTextElement":
      return generateRawTextElement(node, filename);
    case "Interpolation":
      return generateInterpolation(node, filename);
    case "HtmlDirective":
      return generateHtmlDirective(node, filename);
    case "IfBlock":
      return generateIfBlock(node, componentNames, filename);
    case "EachBlock":
      return generateEachBlock(node, componentNames, filename);
    case "ConstTag":
    case "LetTag":
      return "\"\"";
    case "DebugDirective":
    case "Error":
    case "SlateScriptElement":
      return "";
  }
}

function generateIfStatement(node: IfBlockCst, componentNames: Set<string>, target: string, filename: string): string {
  const condition = node.open.expression ? wrapExpression(node.open.expression.text, filename, node.open.expression.range, "template") : "false";
  const thenBody = generateStatements(node.then, componentNames, target, filename);
  const elseBody = node.else ? generateStatements(node.else, componentNames, target, filename) : "";

  if (!node.else) {
    return `if (${condition}) {\n${indent(thenBody, 2)}\n}`;
  }

  return `if (${condition}) {\n${indent(thenBody, 2)}\n} else {\n${indent(elseBody, 2)}\n}`;
}

function generateEachStatement(node: EachBlockCst, componentNames: Set<string>, target: string, filename: string): string {
  const list = `Array.from(${wrapExpression(node.expression.text, filename, node.expression.range, "template")})`;
  const item = node.item;
  const body = generateStatements(node.children, componentNames, target, filename);
  const elseBody = node.else ? generateStatements(node.else, componentNames, target, filename) : "";
  const entry = node.index ? `${node.index}, ${item}` : `_, ${item}`;

  if (!node.else) {
    return `for (const [${entry}] of ${list}.entries()) {\n${indent(body, 2)}\n}`;
  }

  return `const __items = ${list};\nif (__items.length) {\n  for (const [${entry}] of __items.entries()) {\n${indent(body, 4)}\n  }\n} else {\n${indent(elseBody, 2)}\n}`;
}

function generateEachBlock(node: EachBlockCst, componentNames: Set<string>, filename: string): string {
  const item = node.item;
  const index = node.index ? `, ${node.index}` : "";
  const body = node.children.map((child) => generateNode(child, componentNames, filename)).filter(Boolean).join(",\n          ");
  const elseBody = node.else?.map((child) => generateNode(child, componentNames, filename)).filter(Boolean).join(",\n        ");
  const eachExpression = `Array.from(${wrapExpression(node.expression.text, filename, node.expression.range, "template")})`;
  const rendered = `${eachExpression}.length ? ${eachExpression}.map((${item}${index}) => [\n          ${body}\n        ].join("")).join("")`;

  if (!node.else) {
    return `${eachExpression}.map((${item}${index}) => [\n          ${body}\n        ].join("")).join("")`;
  }

  return `${rendered} : [\n        ${elseBody ?? ""}\n      ].join("")`;
}

function generateIfBlock(node: IfBlockCst, componentNames: Set<string>, filename: string): string {
  const condition = node.open.expression ? wrapExpression(node.open.expression.text, filename, node.open.expression.range, "template") : "false";
  const thenBody = node.then.map((child) => generateNode(child, componentNames, filename)).filter(Boolean).join(",\n        ");
  const elseBody = node.else?.map((child) => generateNode(child, componentNames, filename)).filter(Boolean).join(",\n        ");

  return `(${condition}) ? [\n        ${thenBody}\n      ].join("") : [\n        ${elseBody ?? ""}\n      ].join("")`;
}

function generateText(node: TextCst): string {
  return JSON.stringify(node.text);
}

function generateInterpolation(node: InterpolationCst, filename: string): string {
  return `escapeHTML(${wrapExpression(node.expression.text, filename, node.expression.range, "template")})`;
}

function generateHtmlDirective(node: HtmlDirectiveCst, filename: string): string {
  return `String(${wrapExpression(node.expression.text, filename, node.expression.range, "template")})`;
}

function generateElement(node: ElementCst, componentNames: Set<string>, filename: string): string {
  if (componentNames.has(node.rawTagName)) {
    return generateComponent(node, filename);
  }

  if (node.tagName === "slot") {
    return generateSlotOutlet(node, componentNames, filename);
  }

  if (node.selfClosing) {
    return `[${generateOpenTagParts(node.rawTagName, node.openTag.attributes, true, filename).join(", ")}].join("")`;
  }

  const children = node.children.map((child) => generateNode(child, componentNames, filename)).filter(Boolean);
  const close = node.closeTag ? `</${node.closeTag.rawTagName}>` : "";

  return [
    "[",
    ...generateOpenTagParts(node.rawTagName, node.openTag.attributes, false, filename).map((part) => `  ${part},`),
    ...children.map((child) => `  ${child},`),
    `  ${JSON.stringify(close)}`,
    "].join(\"\")",
  ].join("\n");
}

function generateOpenTagParts(rawTagName: string, attributes: AttributeCst[], selfClosing: boolean, filename: string): string[] {
  return [
    JSON.stringify(`<${rawTagName}`),
    ...generateAttributeParts(attributes, filename),
    JSON.stringify(selfClosing ? " />" : ">"),
  ];
}

function generateAttributeParts(attributes: AttributeCst[], filename: string): string[] {
  const chunks: string[] = [];

  for (const attr of attributes) {
    if (attr.kind === "BooleanAttribute") {
      chunks.push(JSON.stringify(` ${attr.rawName}`));
      continue;
    }

    if (attr.kind === "StringAttribute") {
      chunks.push(JSON.stringify(` ${attr.rawName}=${attr.quote}${escapeAttributeLiteral(attr.value)}${attr.quote}`));
      continue;
    }

    if (attr.kind === "ExpressionAttribute") {
      chunks.push(JSON.stringify(` ${attr.rawName}="`));

      const expression = wrapExpression(attr.expression.text, filename, attr.expression.range, "template");

      if (attr.name === "class") {
        chunks.push(`escapeHTML(serializeClass(${expression}))`);
      } else if (attr.name === "style") {
        chunks.push(`escapeHTML(serializeStyle(${expression}))`);
      } else {
        chunks.push(`escapeHTML(${expression})`);
      }

      chunks.push(JSON.stringify("\""));
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

function generateSlotOutlet(node: ElementCst, componentNames: Set<string>, filename: string): string {
  const nameAttr = node.openTag.attributes.find(
    (attr) => attr.kind === "StringAttribute" && attr.name === "name",
  );
  const dataAttr = node.openTag.attributes.find(
    (attr) => attr.kind === "ExpressionAttribute" && attr.name === "data",
  );
  const name = nameAttr?.kind === "StringAttribute" ? nameAttr.value : "default";
  const fallback = node.children.length
    ? `[\n      ${node.children.map((child) => generateNode(child, componentNames, filename)).filter(Boolean).join(",\n      ")}\n    ].join("")`
    : "\"\"";
  const data = dataAttr?.kind === "ExpressionAttribute"
    ? wrapExpression(dataAttr.expression.text, filename, dataAttr.expression.range, "slot")
    : "undefined";

  return `await renderSlot(slots, ${JSON.stringify(name)}, ${fallback}, ${data})`;
}

function generateComponent(node: ElementCst, filename: string): string {
  return `await ${node.rawTagName}.render(${generatePropsObject(node.openTag.attributes, filename)}, ${generateSlotsObject(node, filename)}, context)`;
}

function generateSlotsObject(node: ElementCst, filename: string): string {
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

    return `${JSON.stringify(name)}: async (${params}) => {\n      let __html = \"\";\n${indent(generateStatements(slot.children, new Set(), "__html", filename), 6)}\n      return __html;\n    }`;
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

function generatePropsObject(attributes: AttributeCst[], filename: string): string {
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
      props.push(`${JSON.stringify(attr.name)}: ${wrapExpression(attr.expression.text, filename, attr.expression.range, "component")}`);
      continue;
    }
  }

  return `{ ${props.join(", ")} }`;
}

function generateRawTextElement(node: RawTextElementCst, filename: string): string {
  const close = node.closeTag ? `</${node.closeTag.rawTagName}>` : "";
  const html = generateJoined([
    ...generateOpenTagParts(node.rawTagName, node.openTag.attributes, false, filename).map((part) => `  ${part},`),
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
): string {
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
  const result = ts.transpileModule(body, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      removeComments: false,
    },
  });

  return {
    imports,
    body: result.outputText.replace(/\n?export \{\};\s*$/m, ""),
  };
}

function splitSlateScript(text: string): { imports: string; body: string } {
  const sourceFile = ts.createSourceFile("component.slate.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports: string[] = [];
  const removals: Array<[number, number]> = [];

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      imports.push(text.slice(statement.getFullStart(), statement.getEnd()).trim());
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

function stripTypeOnlyExports(text: string): string {
  const sourceFile = ts.createSourceFile("component.slate.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
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
