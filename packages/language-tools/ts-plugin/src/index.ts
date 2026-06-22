import { dirname, resolve } from "node:path";
import ts from "typescript";
import {
  parse,
  type AttributeCst,
  type DirectiveAttributeCst,
  type EachBlockCst,
  type ElementCst,
  type Range,
  type SlateScriptElementCst,
  type TemplateCstNode,
} from "@slate/compiler";

const SLATE_EXTENSION = ".slate";
const VIRTUAL_EXTENSION = ".slate.ts";
const MODULE_VIRTUAL_EXTENSION = ".slate.module.ts";

export type SlateVirtualMappingKind = "script" | "template" | "generated";

export type SlateVirtualMapping = {
  kind: SlateVirtualMappingKind;
  original?: Range;
  generated: Range;
};

export type SlateVirtualDocument = {
  filename: string;
  virtualFilename: string;
  source: string;
  text: string;
  script?: SlateScriptElementCst;
  mappings: SlateVirtualMapping[];
};

export type TypeScriptPluginModules = {
  typescript: typeof ts;
};

export type TypeScriptPluginModule = {
  create(info: ts.server.PluginCreateInfo): ts.LanguageService;
};

export const RUNE_DECLARATIONS: string = [
  "",
  "export {};",
  "declare function $prop<T>(name: string, defaultValue?: T): T;",
  "declare function $props<T extends Record<string, unknown>>(defaults?: Partial<T>): T;",
  "declare function $inject<T = unknown>(key: string | symbol, fallback?: T): T;",
  "declare function $provide<T>(key: string | symbol, value: T): void;",
  "declare function $slot(name: string): () => __SlateRenderResult;",
  "declare function $slot<T>(name: string): (data: T) => __SlateRenderResult;",
  "declare function $slot<T>(name: string, defaultData: T): (data?: T) => __SlateRenderResult;",
  "declare function __slateEach<T>(value: Iterable<T> | ArrayLike<T>): Iterable<[number, T]>;",
  "declare const __SLATE_HTML: unique symbol;",
  "type __SlateHTML = { readonly [__SLATE_HTML]: true; readonly value: string };",
  "type __SlateRenderResult = __SlateHTML | Promise<__SlateHTML>;",
  "type __SlatePropsOf<T> = T extends { render: (...args: any[]) => unknown } ? NonNullable<Parameters<T[\"render\"]>[0]> : Record<string, unknown>;",
  "type __SlateSlotsOf<T> = T extends { render: (...args: any[]) => unknown } ? NonNullable<Parameters<T[\"render\"]>[1]> : Record<string, unknown>;",
  "type __SlatePropValue<T, K extends PropertyKey> = K extends keyof __SlatePropsOf<T> ? __SlatePropsOf<T>[K] : unknown;",
  "type __SlateDefaultedProps<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;",
  "type __SlateUnionToIntersection<T> = (T extends unknown ? (value: T) => void : never) extends (value: infer I) => void ? I : never;",
  "type __SlatePropEntry<K extends PropertyKey, T, HasDefault extends boolean> = HasDefault extends true ? { [P in K]?: T } : undefined extends T ? { [P in K]?: T } : { [P in K]: T };",
  "declare module \"*.slate\" { const component: unknown; export default component; }",
  "declare module \"*.avif\" { const url: string; export default url; }",
  "declare module \"*.bmp\" { const url: string; export default url; }",
  "declare module \"*.gif\" { const url: string; export default url; }",
  "declare module \"*.ico\" { const url: string; export default url; }",
  "declare module \"*.jpeg\" { const url: string; export default url; }",
  "declare module \"*.jpg\" { const url: string; export default url; }",
  "declare module \"*.png\" { const url: string; export default url; }",
  "declare module \"*.svg\" { const url: string; export default url; }",
  "declare module \"*.webp\" { const url: string; export default url; }",
  "declare module \"*.woff\" { const url: string; export default url; }",
  "declare module \"*.woff2\" { const url: string; export default url; }",
  "declare module \"*.ttf\" { const url: string; export default url; }",
  "declare module \"*.otf\" { const url: string; export default url; }",
  "declare module \"*.eot\" { const url: string; export default url; }",
  "declare module \"*?url\" { const url: string; export default url; }",
  "declare module \"*?raw\" { const source: string; export default source; }",
  "",
].join("\n");

export function createSlateVirtualDocument(source: string, filename = "component.slate"): SlateVirtualDocument {
  const parsed = parse(source, {
    filename,
  });
  const script = parsed.cst.children.find(
    (child): child is SlateScriptElementCst => child.kind === "SlateScriptElement",
  );
  const componentNames = collectImportedComponentNames(script);
  const masked = maskNonNewlineContent(source);
  const mappings: SlateVirtualMapping[] = [];
  let text = masked;

  if (script) {
    text = replaceRange(text, script.body.range, script.body.text);
    mappings.push({
      kind: "script",
      original: script.body.range,
      generated: script.body.range,
    });
  }

  const builder = new VirtualDocumentBuilder(text, mappings, source);
  builder.appendGenerated(RUNE_DECLARATIONS);

  for (const child of parsed.cst.children) {
    if (child.kind === "SlateScriptElement") {
      continue;
    }

    appendTemplateNode(builder, child, componentNames);
  }

  text = builder.text;

  return {
    filename,
    virtualFilename: toVirtualFilename(filename),
    source,
    text,
    script,
    mappings,
  };
}

export function createSlateModuleSource(source: string, filename: string): string {
  const parsed = parse(source, {
    filename,
  });
  const script = parsed.cst.children.find(
    (child): child is SlateScriptElementCst => child.kind === "SlateScriptElement",
  );
  const typeModule = script
    ? extractTypeModuleSource(script.body.text)
    : {
        source: "",
        runtimeSource: "",
        hasPropsType: false,
        hasSlotsType: false,
      };
  const inferredPropsSource = createInferredPropsSource(typeModule.runtimeSource);
  const propsExport = typeModule.hasPropsType ? "" : "export type Props = __SlateInferredProps;";
  const slotsExport = typeModule.hasSlotsType ? "" : "export type Slots = __SlateInferredSlots;";
  const slotOutlets = [
    ...collectSlotOutlets(parsed.cst.children),
    ...collectSlotRunes(typeModule.runtimeSource),
  ];

  return [
    typeModule.source,
    RUNE_DECLARATIONS,
    typeModule.runtimeSource,
    inferredPropsSource,
    createSlotTypesSource(slotOutlets),
    propsExport,
    slotsExport,
    "export type Component<TProps = Record<string, unknown>, TSlots = Record<string, unknown>> = {",
    "  render(props?: TProps, slots?: TSlots, context?: unknown): __SlateRenderResult;",
    "};",
    "declare const component: Component<Props, Slots>;",
    "export default component;",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function createUnknownSlateModuleSource(): string {
  return [
    "export type Props = Record<string, unknown>;",
    "export type Slots = Record<string, unknown>;",
    RUNE_DECLARATIONS,
    "export type Component<TProps = Record<string, unknown>, TSlots = Record<string, unknown>> = {",
    "  render(props?: TProps, slots?: TSlots, context?: unknown): __SlateRenderResult;",
    "};",
    "declare const component: Component<Props, Slots>;",
    "export default component;",
    "",
  ].join("\n");
}

export const SLATE_TYPE_SCRIPT_COMPILER_OPTIONS: ts.CompilerOptions = {
  allowArbitraryExtensions: true,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
  strict: true,
  target: ts.ScriptTarget.ES2022,
};

export type SlateTypeScriptHostOptions = {
  virtualDocument: SlateVirtualDocument;
  compilerOptions?: ts.CompilerOptions;
  currentDirectory?: string;
  getScriptVersion?: (filename: string) => string;
  readSlateSource?: (filename: string) => string | undefined;
  readFile?: (filename: string) => string | undefined;
  fileExists?: (filename: string) => boolean;
};

export type SlateCompilerHostOptions = SlateTypeScriptHostOptions & {
  sourceFile: ts.SourceFile;
};

export function createSlateLanguageServiceHost(options: SlateTypeScriptHostOptions): ts.LanguageServiceHost {
  const compilerOptions = options.compilerOptions ?? SLATE_TYPE_SCRIPT_COMPILER_OPTIONS;
  const sources = createSlateTypeScriptSourceHost(options);
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => compilerOptions,
    getCurrentDirectory: () => options.currentDirectory ?? dirname(options.virtualDocument.filename),
    getDefaultLibFileName: (hostOptions) => ts.getDefaultLibFilePath(hostOptions),
    getScriptFileNames: () => [options.virtualDocument.virtualFilename],
    getScriptKind: (filename) => sources.getScriptKind(filename),
    getScriptSnapshot: (filename) => {
      const source = sources.readFile(filename);
      return source === undefined ? undefined : ts.ScriptSnapshot.fromString(source);
    },
    getScriptVersion: (filename) => options.getScriptVersion?.(filename) ?? "0",
    fileExists: (filename) => sources.fileExists(filename),
    readFile: (filename) => sources.readFile(filename),
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    resolveModuleNames: (moduleNames, containingFile) =>
      sources.resolveModuleNames(moduleNames, containingFile, compilerOptions),
  };

  return host;
}

export function createSlateCompilerHost(options: SlateCompilerHostOptions): ts.CompilerHost {
  const compilerOptions = options.compilerOptions ?? SLATE_TYPE_SCRIPT_COMPILER_OPTIONS;
  const baseHost = ts.createCompilerHost(compilerOptions);
  const baseGetSourceFile = baseHost.getSourceFile.bind(baseHost);
  const sources = createSlateTypeScriptSourceHost({
    ...options,
    readFile: options.readFile ?? baseHost.readFile.bind(baseHost),
    fileExists: options.fileExists ?? baseHost.fileExists.bind(baseHost),
  });

  baseHost.getSourceFile = (filename, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (filename === options.virtualDocument.virtualFilename) {
      return options.sourceFile;
    }

    const source = sources.readFile(filename);

    if (source !== undefined && sources.isSlateManagedFile(filename)) {
      return ts.createSourceFile(filename, source, languageVersion, true, ts.ScriptKind.TS);
    }

    return baseGetSourceFile(filename, languageVersion, onError, shouldCreateNewSourceFile);
  };
  baseHost.fileExists = (filename) => sources.fileExists(filename);
  baseHost.readFile = (filename) => sources.readFile(filename);
  baseHost.resolveModuleNames = (moduleNames, containingFile) =>
    sources.resolveModuleNames(moduleNames, containingFile, compilerOptions);

  return baseHost;
}

function createSlateTypeScriptSourceHost(options: SlateTypeScriptHostOptions): {
  fileExists: (filename: string) => boolean;
  getScriptKind: (filename: string) => ts.ScriptKind;
  isSlateManagedFile: (filename: string) => boolean;
  readFile: (filename: string) => string | undefined;
  resolveModuleNames: (
    moduleNames: string[],
    containingFile: string,
    compilerOptions: ts.CompilerOptions,
  ) => Array<ts.ResolvedModuleFull | undefined>;
} {
  const moduleSources = new Map<string, string>();
  const readFile = options.readFile ?? ts.sys.readFile;
  const fileExists = options.fileExists ?? ts.sys.fileExists;
  const readSlateSource = (filename: string): string | undefined => {
    if (filename === options.virtualDocument.filename) {
      return options.virtualDocument.source;
    }

    return options.readSlateSource?.(filename) ?? readFile(filename);
  };
  const readSlateModuleSource = (filename: string): string => {
    const cached = moduleSources.get(filename);

    if (cached !== undefined) {
      return cached;
    }

    const originalFilename = toOriginalSlateModuleFilename(filename);
    const source = readSlateSource(originalFilename);
    const moduleSource = source === undefined
      ? createUnknownSlateModuleSource()
      : createSlateModuleSource(source, originalFilename);
    moduleSources.set(filename, moduleSource);
    return moduleSource;
  };
  const isSlateManagedFile = (filename: string): boolean =>
    filename === options.virtualDocument.virtualFilename || isSlateModuleVirtualFile(filename);

  return {
    fileExists(filename) {
      if (filename === options.virtualDocument.virtualFilename) {
        return true;
      }

      if (isSlateModuleVirtualFile(filename)) {
        return readSlateSource(toOriginalSlateModuleFilename(filename)) !== undefined;
      }

      if (filename.endsWith(SLATE_EXTENSION)) {
        return readSlateSource(filename) !== undefined;
      }

      return fileExists(filename);
    },
    getScriptKind(filename) {
      return isSlateManagedFile(filename) ? ts.ScriptKind.TS : ts.ScriptKind.Unknown;
    },
    isSlateManagedFile,
    readFile(filename) {
      if (filename === options.virtualDocument.virtualFilename) {
        return options.virtualDocument.text;
      }

      if (isSlateModuleVirtualFile(filename)) {
        return readSlateModuleSource(filename);
      }

      return readFile(filename);
    },
    resolveModuleNames(moduleNames, containingFile, compilerOptions) {
      return moduleNames.map((moduleName) => {
        const resolvedSlateModule = resolveSlateImport(moduleName, containingFile, readSlateSource);

        if (resolvedSlateModule) {
          return resolvedSlateModule;
        }

        return ts.resolveModuleName(moduleName, containingFile, compilerOptions, this).resolvedModule;
      });
    },
  };
}

function resolveSlateImport(
  moduleName: string,
  containingFile: string,
  readSlateSource: (filename: string) => string | undefined,
): ts.ResolvedModuleFull | undefined {
  if (!moduleName.endsWith(SLATE_EXTENSION) || (!moduleName.startsWith(".") && !moduleName.startsWith("/"))) {
    return undefined;
  }

  const containingOriginalFile = toOriginalFilename(containingFile);
  const resolvedOriginalFile = resolve(dirname(containingOriginalFile), moduleName);

  if (readSlateSource(resolvedOriginalFile) === undefined) {
    return undefined;
  }

  return {
    resolvedFileName: toSlateModuleVirtualFilename(resolvedOriginalFile),
    extension: ts.Extension.Ts,
    isExternalLibraryImport: false,
  };
}

function extractTypeModuleSource(source: string): {
  source: string;
  runtimeSource: string;
  hasPropsType: boolean;
  hasSlotsType: boolean;
} {
  const sourceFile = ts.createSourceFile("component.slate.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const chunks: string[] = [];
  const runtimeChunks: string[] = [];
  let hasPropsType = false;
  let hasSlotsType = false;

  for (const statement of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      chunks.push(source.slice(statement.getFullStart(), statement.getEnd()).trim());

      if (statement.name.text === "Props") {
        hasPropsType = true;
      }

      if (statement.name.text === "Slots") {
        hasSlotsType = true;
      }

      continue;
    }

    if (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly) {
      chunks.push(source.slice(statement.getFullStart(), statement.getEnd()).trim());
      continue;
    }

    if (ts.isExportDeclaration(statement) && statement.isTypeOnly) {
      chunks.push(source.slice(statement.getFullStart(), statement.getEnd()).trim());
      continue;
    }

    if (ts.isExportDeclaration(statement)) {
      continue;
    }

    runtimeChunks.push(source.slice(statement.getFullStart(), statement.getEnd()).trim());
  }

  return {
    source: chunks.join("\n"),
    runtimeSource: runtimeChunks.join("\n"),
    hasPropsType,
    hasSlotsType,
  };
}

function createInferredPropsSource(runtimeSource: string): string {
  const sourceFile = ts.createSourceFile("component.slate.ts", runtimeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const propEntries: string[] = [];
  const spreads: string[] = [];

  const visit = (node: ts.Node): void => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) {
      ts.forEachChild(node, visit);
      return;
    }

    const initializer = node.initializer;

    if (!ts.isCallExpression(initializer)) {
      ts.forEachChild(node, visit);
      return;
    }

    if (ts.isIdentifier(initializer.expression) && initializer.expression.text === "$prop") {
      const key = initializer.arguments[0];

      if (!key || !ts.isStringLiteralLike(key)) {
        ts.forEachChild(node, visit);
        return;
      }

      propEntries.push(`__SlatePropEntry<${JSON.stringify(key.text)}, ${propTypeFromCall(initializer, runtimeSource)}, ${propCallHasDefault(initializer) ? "true" : "false"}>`);
      return;
    }

    if (ts.isIdentifier(initializer.expression) && initializer.expression.text === "$props") {
      spreads.push(propsTypeFromCall(initializer, node.name.text, runtimeSource, sourceFile));
      return;
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);

  const objectType = propEntries.length > 0 ? `__SlateUnionToIntersection<${propEntries.join(" | ")}>` : "Record<string, unknown>";
  const inferred = [objectType, ...spreads].join(" & ");

  return `type __SlateInferredProps = ${inferred};`;
}

function propCallHasDefault(call: ts.CallExpression): boolean {
  return call.arguments.length >= 2;
}

function propsTypeFromCall(call: ts.CallExpression, localName: string, source: string, sourceFile: ts.SourceFile): string {
  const typeArgument = call.typeArguments?.[0];
  const defaults = call.arguments[0];

  if (!defaults) {
    return `typeof ${localName}`;
  }

  const defaultKeys = staticObjectKeys(defaults);

  if (!defaultKeys.length) {
    return `typeof ${localName}`;
  }

  const keyUnion = defaultKeys.map((key) => JSON.stringify(key)).join(" | ");

  if (typeArgument) {
    const typeText = source.slice(typeArgument.getStart(sourceFile), typeArgument.getEnd());
    return `__SlateDefaultedProps<${typeText}, Extract<${keyUnion}, keyof ${typeText}>>`;
  }

  return `__SlateDefaultedProps<typeof ${localName}, ${keyUnion}>`;
}

function staticObjectKeys(node: ts.Expression): string[] {
  if (!ts.isObjectLiteralExpression(node)) {
    return [];
  }

  const keys: string[] = [];

  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
      continue;
    }

    const name = property.name;

    if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
      keys.push(name.text);
    }
  }

  return Array.from(new Set(keys));
}

function propTypeFromCall(call: ts.CallExpression, source: string): string {
  const typeArgument = call.typeArguments?.[0];

  if (typeArgument) {
    return source.slice(typeArgument.getStart(), typeArgument.getEnd());
  }

  const defaultValue = call.arguments[1];

  if (!defaultValue) {
    return "unknown";
  }

  if (ts.isStringLiteralLike(defaultValue)) {
    return "string";
  }

  if (ts.isNumericLiteral(defaultValue)) {
    return "number";
  }

  if (defaultValue.kind === ts.SyntaxKind.TrueKeyword || defaultValue.kind === ts.SyntaxKind.FalseKeyword) {
    return "boolean";
  }

  if (defaultValue.kind === ts.SyntaxKind.NullKeyword) {
    return "null";
  }

  return `typeof (${source.slice(defaultValue.getStart(), defaultValue.getEnd())})`;
}

type SlotOutlet = {
  name: string;
  dataExpression?: string;
  dataType?: string;
};

function collectSlotRunes(source: string): SlotOutlet[] {
  const outlets: SlotOutlet[] = [];
  const sourceFile = ts.createSourceFile("component.slate.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "$slot" &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      const typeArgument = node.typeArguments?.[0];
      const defaultData = node.arguments[1];
      outlets.push({
        name: node.arguments[0].text || "default",
        dataExpression: defaultData ? source.slice(defaultData.getStart(sourceFile), defaultData.getEnd()) : undefined,
        dataType: typeArgument ? source.slice(typeArgument.getStart(sourceFile), typeArgument.getEnd()) : undefined,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return outlets;
}

function collectSlotOutlets(nodes: TemplateCstNode[], outlets: SlotOutlet[] = []): SlotOutlet[] {
  for (const node of nodes) {
    if (node.kind === "Element") {
      if (node.tagName === "slot") {
        outlets.push({
          name: getSlotOutletName(node),
          dataExpression: getSlotOutletDataExpression(node),
        });
      }

      collectSlotOutlets(node.children, outlets);
      continue;
    }

    if (node.kind === "IfBlock") {
      collectSlotOutlets(node.then, outlets);

      if (node.else) {
        collectSlotOutlets(node.else, outlets);
      }

      continue;
    }

    if (node.kind === "EachBlock") {
      collectSlotOutlets(node.children, outlets);

      if (node.else) {
        collectSlotOutlets(node.else, outlets);
      }
    }
  }

  return outlets;
}

function getSlotOutletName(node: ElementCst): string {
  const nameAttribute = node.openTag.attributes.find((attribute) => attribute.name === "name");

  if (nameAttribute?.kind === "StringAttribute") {
    return nameAttribute.value || "default";
  }

  return "default";
}

function getSlotOutletDataExpression(node: ElementCst): string | undefined {
  const dataAttribute = node.openTag.attributes.find((attribute) => attribute.name === "data");

  if (dataAttribute?.kind === "ExpressionAttribute") {
    return dataAttribute.expression.text;
  }

  return undefined;
}

function createSlotTypesSource(outlets: SlotOutlet[]): string {
  if (outlets.length === 0) {
    return "type __SlateInferredSlots = Record<string, unknown>;";
  }

  const slotDataTypes = new Map<string, string[]>();

  outlets.forEach((outlet) => {
    const types = slotDataTypes.get(outlet.name) ?? [];
    slotDataTypes.set(outlet.name, types);

    if (outlet.dataType) {
      types.push(outlet.dataType);
      return;
    }

    if (!outlet.dataExpression) {
      types.push("undefined");
      return;
    }

    types.push(slotDataTypeFromExpression(outlet.dataExpression));
  });

  const properties = Array.from(slotDataTypes, ([name, types]) => {
    const dataType = Array.from(new Set(types)).join(" | ");
    const parameter = dataType === "undefined" ? "data?: undefined" : `data: ${dataType}`;
    return `  ${JSON.stringify(name)}?: (${parameter}) => unknown;`;
  });

  return [
    "type __SlateInferredSlots = {",
    ...properties,
    "};",
  ].join("\n");
}

function slotDataTypeFromExpression(expression: string): string {
  const sourceFile = ts.createSourceFile(
    "slot-data.ts",
    `const __slotData = (${expression});`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const statement = sourceFile.statements[0];
  const initializer = statement && ts.isVariableStatement(statement)
    ? statement.declarationList.declarations[0]?.initializer
    : undefined;
  const object = initializer ? unwrapExpression(initializer) : undefined;

  if (
    !object ||
    !ts.isObjectLiteralExpression(object)
  ) {
    return `typeof (${expression})`;
  }

  const properties: string[] = [];

  for (const property of object.properties) {
    if (ts.isShorthandPropertyAssignment(property)) {
      properties.push(`  ${property.name.text}: typeof ${property.name.text};`);
      continue;
    }

    if (ts.isPropertyAssignment(property)) {
      const name = propertyNameToTypeKey(property.name);

      if (!name) {
        return `typeof (${expression})`;
      }

      properties.push(`  ${name}: typeof (${expression.slice(property.initializer.getStart(), property.initializer.getEnd())});`);
      continue;
    }

    return `typeof (${expression})`;
  }

  return properties.length > 0 ? ["{", ...properties, "}"].join("\n") : "{}";
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;

  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }

  return current;
}

function propertyNameToTypeKey(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name)) {
    return name.text;
  }

  if (ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return JSON.stringify(name.text);
  }

  return undefined;
}

export function toVirtualFilename(filename: string): string {
  return filename.endsWith(SLATE_EXTENSION) ? `${filename}.ts` : filename;
}

export function isSlateFile(filename: string): boolean {
  return filename.endsWith(SLATE_EXTENSION);
}

export function isSlateVirtualFile(filename: string): boolean {
  return filename.endsWith(VIRTUAL_EXTENSION);
}

export function isSlateModuleVirtualFile(filename: string): boolean {
  return filename.endsWith(MODULE_VIRTUAL_EXTENSION);
}

export function toSlateModuleVirtualFilename(filename: string): string {
  return filename.endsWith(SLATE_EXTENSION) ? `${filename}.module.ts` : filename;
}

export function toOriginalSlateModuleFilename(filename: string): string {
  return isSlateModuleVirtualFile(filename) ? filename.slice(0, -".module.ts".length) : filename;
}

export function toOriginalFilename(filename: string): string {
  if (isSlateModuleVirtualFile(filename)) {
    return toOriginalSlateModuleFilename(filename);
  }

  return isSlateVirtualFile(filename) ? filename.slice(0, -".ts".length) : filename;
}

export function toVirtualOffset(document: SlateVirtualDocument, originalOffset: number): number | undefined {
  for (const mapping of document.mappings) {
    if (!mapping.original) {
      continue;
    }

    if (originalOffset >= mapping.original.start && originalOffset <= mapping.original.end) {
      return mapping.generated.start + originalOffset - mapping.original.start;
    }
  }

  return undefined;
}

export function toOriginalOffset(document: SlateVirtualDocument, virtualOffset: number): number | undefined {
  for (const mapping of document.mappings) {
    if (!mapping.original) {
      continue;
    }

    if (virtualOffset >= mapping.generated.start && virtualOffset <= mapping.generated.end) {
      return mapping.original.start + virtualOffset - mapping.generated.start;
    }
  }

  return undefined;
}

export default function createPlugin(modules: TypeScriptPluginModules): TypeScriptPluginModule {
  const tsModule = modules.typescript;

  return {
    create(info) {
      patchLanguageServiceHost(tsModule, info);
      info.project.projectService.logger.info("[slate] TypeScript plugin initialized.");
      return info.languageService;
    },
  };
}

function patchLanguageServiceHost(tsModule: typeof ts, info: ts.server.PluginCreateInfo): void {
  const host = info.languageServiceHost;
  const hostWithFileSystem = host as ts.LanguageServiceHost & {
    fileExists?: (filename: string) => boolean;
    readFile?: (filename: string) => string | undefined;
  };
  const getScriptSnapshot = host.getScriptSnapshot?.bind(host);
  const getScriptKind = host.getScriptKind?.bind(host);
  const getCompilationSettings = host.getCompilationSettings?.bind(host);
  const fileExists = hostWithFileSystem.fileExists?.bind(hostWithFileSystem);
  const readFile = hostWithFileSystem.readFile?.bind(hostWithFileSystem);
  const resolveModuleNames = host.resolveModuleNames?.bind(host);
  const resolveModuleNameLiterals = host.resolveModuleNameLiterals?.bind(host);
  const readSlateSourceFromHost = (filename: string): string | undefined =>
    readSlateSourceFromPluginHost(filename, getScriptSnapshot, tsModule);

  host.getScriptSnapshot = (filename) => {
    if (isSlateModuleVirtualFile(filename)) {
      const source = readSlateSourceFromHost(toOriginalSlateModuleFilename(filename));

      if (source === undefined) {
        return undefined;
      }

      return tsModule.ScriptSnapshot.fromString(createSlateModuleSource(source, toOriginalSlateModuleFilename(filename)));
    }

    if (!isSlateFile(filename)) {
      return getScriptSnapshot?.(filename);
    }

    const sourceSnapshot = getScriptSnapshot?.(filename);
    const source = sourceSnapshot?.getText(0, sourceSnapshot.getLength()) ?? tsModule.sys.readFile(filename);

    if (source === undefined) {
      return undefined;
    }

    const virtualDocument = createSlateVirtualDocument(source, filename);
    return tsModule.ScriptSnapshot.fromString(virtualDocument.text);
  };

  host.getScriptKind = (filename) => {
    if (isSlateFile(filename) || isSlateModuleVirtualFile(filename)) {
      return tsModule.ScriptKind.TS;
    }

    return getScriptKind?.(filename) ?? tsModule.ScriptKind.Unknown;
  };

  host.getCompilationSettings = () => {
    const options = getCompilationSettings?.() ?? {};
    return {
      ...options,
      allowArbitraryExtensions: true,
    };
  };

  hostWithFileSystem.fileExists = (filename) => {
    if (isSlateModuleVirtualFile(filename)) {
      const originalFilename = toOriginalSlateModuleFilename(filename);
      return readSlateSourceFromHost(originalFilename) !== undefined;
    }

    return fileExists?.(filename) ?? tsModule.sys.fileExists(filename);
  };

  hostWithFileSystem.readFile = (filename) => {
    if (isSlateModuleVirtualFile(filename)) {
      const originalFilename = toOriginalSlateModuleFilename(filename);
      const source = readSlateSourceFromHost(originalFilename);
      return source === undefined ? undefined : createSlateModuleSource(source, originalFilename);
    }

    return readFile?.(filename) ?? tsModule.sys.readFile(filename);
  };

  host.resolveModuleNames = (moduleNames, containingFile, reusedNames, redirectedReference, options) =>
    moduleNames.map((moduleName) => {
      const resolvedSlateModule = resolveSlateImport(moduleName, containingFile, readSlateSourceFromHost);

      if (resolvedSlateModule) {
        return resolvedSlateModule;
      }

      if (resolveModuleNames) {
        return resolveModuleNames([moduleName], containingFile, reusedNames, redirectedReference, options)[0];
      }

      return tsModule.resolveModuleName(
        moduleName,
        containingFile,
        options ?? getCompilationSettings?.() ?? {},
        hostWithFileSystem,
      ).resolvedModule;
    });

  host.resolveModuleNameLiterals = (moduleLiterals, containingFile, redirectedReference, options, containingSourceFile, reusedNames) =>
    moduleLiterals.map((moduleLiteral) => {
      const resolvedSlateModule = resolveSlateImport(moduleLiteral.text, containingFile, readSlateSourceFromHost);

      if (resolvedSlateModule) {
        return {
          resolvedModule: resolvedSlateModule,
        };
      }

      if (resolveModuleNameLiterals) {
        return resolveModuleNameLiterals(
          [moduleLiteral],
          containingFile,
          redirectedReference,
          options,
          containingSourceFile,
          reusedNames,
        )[0];
      }

      return tsModule.resolveModuleName(
        moduleLiteral.text,
        containingFile,
        options,
        hostWithFileSystem,
        undefined,
        redirectedReference,
        moduleResolutionMode(moduleLiteral),
      );
    });
}

function moduleResolutionMode(moduleLiteral: ts.StringLiteralLike): ts.ResolutionMode | undefined {
  return (moduleLiteral as { impliedNodeFormat?: ts.ResolutionMode }).impliedNodeFormat;
}

function readSlateSourceFromPluginHost(
  filename: string,
  getScriptSnapshot: ((filename: string) => ts.IScriptSnapshot | undefined) | undefined,
  tsModule: typeof ts,
): string | undefined {
  const snapshot = getScriptSnapshot?.(filename);

  if (snapshot) {
    return snapshot.getText(0, snapshot.getLength());
  }

  return tsModule.sys.readFile(filename);
}

function maskNonNewlineContent(text: string): string {
  let masked = "";

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    masked += char === "\n" || char === "\r" ? char : " ";
  }

  return masked;
}

function replaceRange(text: string, range: Range, value: string): string {
  return text.slice(0, range.start) + value + text.slice(range.end);
}

class VirtualDocumentBuilder {
  constructor(
    public text: string,
    private readonly mappings: SlateVirtualMapping[],
    readonly source: string,
  ) {}

  appendGenerated(value: string): void {
    const start = this.text.length;
    this.text += value;

    if (value.length > 0) {
      this.mappings.push({
        kind: "generated",
        generated: {
          start,
          end: this.text.length,
        },
      });
    }
  }

  appendMapped(kind: "script" | "template", value: string, original: Range): void {
    const start = this.text.length;
    this.text += value;

    if (value.length > 0) {
      this.mappings.push({
        kind,
        original,
        generated: {
          start,
          end: this.text.length,
        },
      });
    }
  }

  appendIsland(kind: "script" | "template", prefix: string, island: TsIslandLike, suffix: string): void {
    this.appendGenerated(prefix);
    this.appendMapped(kind, island.text, trimmedIslandRange(this.source, island));
    this.appendGenerated(suffix);
  }
}

type TsIslandLike = {
  range: Range;
  text: string;
};

function appendTemplateNode(builder: VirtualDocumentBuilder, node: TemplateCstNode, componentNames: Set<string>): void {
  if (node.kind === "Interpolation") {
    appendTemplateExpression(builder, node.expression);
    return;
  }

  if (node.kind === "HtmlDirective" || node.kind === "DebugDirective") {
    appendTemplateExpression(builder, node.expression);
    return;
  }

  if (node.kind === "ConstTag" || node.kind === "LetTag") {
    builder.appendIsland("template", "", node.statement, ";\n");
    return;
  }

  if (node.kind === "IfBlock") {
    builder.appendGenerated("if (");

    if (node.open.expression) {
      builder.appendMapped("template", node.open.expression.text, trimmedIslandRange(builder.source, node.open.expression));
    } else {
      builder.appendGenerated("true");
    }

    builder.appendGenerated(") {\n");

    for (const child of node.then) {
      appendTemplateNode(builder, child, componentNames);
    }

    if (node.else) {
      builder.appendGenerated("} else {\n");

      for (const child of node.else) {
        appendTemplateNode(builder, child, componentNames);
      }
    }

    builder.appendGenerated("}\n");
    return;
  }

  if (node.kind === "EachBlock") {
    const item = sanitizeIdentifier(node.item, "item");
    const index = node.index ? sanitizeIdentifier(node.index, "index") : undefined;
    const bindingRanges = eachBindingRanges(node);
    builder.appendGenerated("for (const [");

    if (index) {
      appendMappedIdentifier(builder, index, bindingRanges.index);
    }

    builder.appendGenerated(", ");
    appendMappedIdentifier(builder, item, bindingRanges.item);
    builder.appendGenerated("] of __slateEach(");
    builder.appendMapped("template", node.expression.text, trimmedIslandRange(builder.source, node.expression));
    builder.appendGenerated(")) {\n");

    for (const child of node.children) {
      appendTemplateNode(builder, child, componentNames);
    }

    if (node.else) {
      builder.appendGenerated("}\n{\n");

      for (const child of node.else) {
        appendTemplateNode(builder, child, componentNames);
      }
    }

    builder.appendGenerated("}\n");
    return;
  }

  if (node.kind === "Element") {
    appendElement(builder, node, componentNames);
  }
}

function appendElement(builder: VirtualDocumentBuilder, node: ElementCst, componentNames: Set<string>): void {
  const slotDirective = node.openTag.attributes.find(isSlotDirectiveAttribute);

  if (
    node.tagName !== "slot" &&
    slotDirective?.valueKind === "expression" &&
    slotDirective.value &&
    typeof slotDirective.value !== "string"
  ) {
    builder.appendGenerated("{\nconst ");
    builder.appendMapped("template", slotDirective.value.text, trimmedIslandRange(builder.source, slotDirective.value));
    builder.appendGenerated(" = undefined as any;\n");
    appendComponentPropsCheck(builder, node, componentNames);
    appendComponentSlotsCheck(builder, node, componentNames);

    for (const attribute of node.openTag.attributes) {
      if (node.tagName === "slot" && attribute.name === "name") {
        continue;
      }

      if (!isSlotDirectiveAttribute(attribute)) {
        appendAttribute(builder, attribute);
      }
    }

    for (const child of node.children) {
      appendTemplateNode(builder, child, componentNames);
    }

    builder.appendGenerated("}\n");
    return;
  }

  const isComponentElement = componentNames.has(node.rawTagName);

  appendComponentPropsCheck(builder, node, componentNames);
  appendComponentSlotsCheck(builder, node, componentNames);

  for (const attribute of node.openTag.attributes) {
    if (node.tagName === "slot" && attribute.name === "name") {
      continue;
    }

    if (!isSlotDirectiveAttribute(attribute)) {
      appendAttribute(builder, attribute);
    }
  }

  for (const child of node.children) {
    if (isComponentElement && isSlottedElement(child)) {
      continue;
    }

    appendTemplateNode(builder, child, componentNames);
  }
}

function appendComponentSlotsCheck(builder: VirtualDocumentBuilder, node: ElementCst, componentNames: Set<string>): void {
  if (!componentNames.has(node.rawTagName)) {
    return;
  }

  const slotChildren = node.children.filter(
    (child): child is ElementCst =>
      child.kind === "Element" && child.openTag.attributes.some(isSlotDirectiveAttribute),
  );

  if (slotChildren.length === 0) {
    return;
  }

  builder.appendGenerated("void ({\n");

  for (const child of slotChildren) {
    const slotDirective = child.openTag.attributes.find(isSlotDirectiveAttribute);

    if (!slotDirective) {
      continue;
    }

    const slotName = slotDirective.directiveName || "default";
    builder.appendGenerated("  ");
    builder.appendMapped("template", JSON.stringify(slotName), slotDirective.range);
    builder.appendGenerated(": (__slateSlotData) => {\n");

    if (
      slotDirective.valueKind === "expression" &&
      slotDirective.value &&
      typeof slotDirective.value !== "string"
    ) {
      builder.appendGenerated("    const ");
      builder.appendMapped("template", slotDirective.value.text, trimmedIslandRange(builder.source, slotDirective.value));
      builder.appendGenerated(" = __slateSlotData;\n");
    }

    appendSlotContentElement(builder, child, componentNames);
    builder.appendGenerated("  },\n");
  }

  builder.appendGenerated("} ");
  builder.appendMapped("template", "satisfies", node.openTag.range);
  builder.appendGenerated(" __SlateSlotsOf<typeof ");
  builder.appendMapped("template", node.rawTagName, {
    start: node.openTag.range.start + 1,
    end: node.openTag.range.start + 1 + node.rawTagName.length,
  });
  builder.appendGenerated(">);\n");
}

function appendSlotContentElement(
  builder: VirtualDocumentBuilder,
  node: ElementCst,
  componentNames: Set<string>,
): void {
  appendComponentPropsCheck(builder, node, componentNames);
  appendComponentSlotsCheck(builder, node, componentNames);

  for (const attribute of node.openTag.attributes) {
    if (node.tagName === "slot" && attribute.name === "name") {
      continue;
    }

    if (isSlotDirectiveAttribute(attribute)) {
      continue;
    }

    appendAttribute(builder, attribute);
  }

  for (const child of node.children) {
    if (componentNames.has(node.rawTagName) && isSlottedElement(child)) {
      continue;
    }

    appendTemplateNode(builder, child, componentNames);
  }
}

function appendComponentPropsCheck(builder: VirtualDocumentBuilder, node: ElementCst, componentNames: Set<string>): void {
  if (!componentNames.has(node.rawTagName)) {
    return;
  }

  for (const attribute of node.openTag.attributes) {
    if (attribute.kind === "DirectiveAttribute") {
      continue;
    }

    appendComponentPropValueCheck(builder, node, attribute);
  }

  builder.appendGenerated("void (");
  builder.appendMapped("template", "{", node.openTag.range);

  for (const attribute of node.openTag.attributes) {
    if (attribute.kind === "DirectiveAttribute") {
      continue;
    }

    appendComponentPropShape(builder, attribute);
  }

  builder.appendMapped("template", "}", node.openTag.range);
  builder.appendGenerated(" ");
  builder.appendMapped("template", "satisfies", node.openTag.range);
  builder.appendGenerated(" __SlatePropsOf<typeof ");
  builder.appendMapped("template", node.rawTagName, {
    start: node.openTag.range.start + 1,
    end: node.openTag.range.start + 1 + node.rawTagName.length,
  });
  builder.appendGenerated(">);\n");
}

function appendComponentPropValueCheck(
  builder: VirtualDocumentBuilder,
  node: ElementCst,
  attribute: AttributeCst,
): void {
  builder.appendGenerated("void (");
  appendComponentPropValue(builder, attribute);
  builder.appendGenerated(" ");
  builder.appendMapped("template", "satisfies", attributeValueRange(builder.source, attribute));
  builder.appendGenerated(" __SlatePropValue<typeof ");
  builder.appendMapped("template", node.rawTagName, {
    start: node.openTag.range.start + 1,
    end: node.openTag.range.start + 1 + node.rawTagName.length,
  });
  builder.appendGenerated(", ");
  builder.appendMapped("template", JSON.stringify(attribute.name), attributeNameRange(attribute));
  builder.appendGenerated(">);\n");
}

function appendComponentPropShape(builder: VirtualDocumentBuilder, attribute: AttributeCst): void {
  builder.appendMapped("template", JSON.stringify(attribute.name), attributeNameRange(attribute));
  builder.appendGenerated(": ");

  if (attribute.kind === "BooleanAttribute" || attribute.kind === "StringAttribute" || attribute.kind === "ExpressionAttribute") {
    builder.appendGenerated("undefined as any, ");
  }
}

function appendComponentPropValue(builder: VirtualDocumentBuilder, attribute: AttributeCst): void {

  if (attribute.kind === "BooleanAttribute") {
    builder.appendMapped("template", "true", attribute.range);
    return;
  }

  if (attribute.kind === "StringAttribute") {
    builder.appendMapped("template", JSON.stringify(attribute.value), attributeValueRange(builder.source, attribute));
    return;
  }

  if (attribute.kind === "ExpressionAttribute") {
    builder.appendMapped("template", attribute.expression.text, trimmedIslandRange(builder.source, attribute.expression));
  }
}

function attributeNameRange(attribute: AttributeCst): Range {
  return {
    start: attribute.range.start,
    end: attribute.range.start + attribute.rawName.length,
  };
}

function attributeValueRange(source: string, attribute: AttributeCst): Range {
  if (attribute.kind === "ExpressionAttribute") {
    return trimmedIslandRange(source, attribute.expression);
  }

  if (attribute.kind !== "StringAttribute") {
    return attribute.range;
  }

  const raw = source.slice(attribute.range.start, attribute.range.end);
  const firstQuote = raw.indexOf(attribute.quote);
  const lastQuote = raw.lastIndexOf(attribute.quote);

  if (firstQuote < 0 || lastQuote <= firstQuote) {
    return attribute.range;
  }

  return {
    start: attribute.range.start + firstQuote,
    end: attribute.range.start + lastQuote + 1,
  };
}

function appendAttribute(builder: VirtualDocumentBuilder, attribute: AttributeCst): void {
  if (attribute.kind === "ExpressionAttribute") {
    appendTemplateExpression(builder, attribute.expression);
    return;
  }

  if (
    attribute.kind === "DirectiveAttribute" &&
    attribute.valueKind === "expression" &&
    attribute.value &&
    typeof attribute.value !== "string"
  ) {
    appendTemplateExpression(builder, attribute.value);
  }
}

function isSlotDirectiveAttribute(attribute: AttributeCst): attribute is DirectiveAttributeCst {
  return attribute.kind === "DirectiveAttribute" && attribute.namespace === "slot";
}

function isSlottedElement(node: TemplateCstNode): node is ElementCst {
  return node.kind === "Element" && node.openTag.attributes.some(isSlotDirectiveAttribute);
}

function appendTemplateExpression(builder: VirtualDocumentBuilder, island: TsIslandLike): void {
  builder.appendIsland("template", "void (", island, ");\n");
}

function appendMappedIdentifier(builder: VirtualDocumentBuilder, name: string, range: Range | undefined): void {
  if (range) {
    builder.appendMapped("template", name, range);
    return;
  }

  builder.appendGenerated(name);
}

function eachBindingRanges(node: EachBlockCst): { item?: Range; index?: Range } {
  const source = node.open.expression;

  if (!source) {
    return {};
  }

  const match = /^(.*?)\s+as\s+([A-Za-z_$][\w$]*)(?:\s*,\s*([A-Za-z_$][\w$]*))?\s*$/.exec(source.text);

  if (!match?.[2]) {
    return {};
  }

  const itemSearchStart = match[1] ? match[1].length : 0;
  const itemOffset = match.index + match[0].indexOf(match[2], itemSearchStart);
  const ranges: { item?: Range; index?: Range } = {
    item: {
      start: source.range.start + itemOffset,
      end: source.range.start + itemOffset + match[2].length,
    },
  };

  if (match[3]) {
    const indexOffset = match.index + match[0].indexOf(match[3], itemOffset - match.index + match[2].length);
    ranges.index = {
      start: source.range.start + indexOffset,
      end: source.range.start + indexOffset + match[3].length,
    };
  }

  return ranges;
}

function trimmedIslandRange(source: string, island: TsIslandLike): Range {
  if (!island.text) {
    return island.range;
  }

  const raw = source.slice(island.range.start, island.range.end);
  const index = raw.indexOf(island.text);
  const start = island.range.start + Math.max(0, index);

  return {
    start,
    end: start + island.text.length,
  };
}

function sanitizeIdentifier(value: string, fallback: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(value) ? value : fallback;
}

function collectImportedComponentNames(script: SlateScriptElementCst | undefined): Set<string> {
  const names = new Set<string>();

  if (!script) {
    return names;
  }

  const importPattern = /import\s+([A-Za-z_$][\w$]*)\s+from\s+["'][^"']+\.slate["']/g;

  for (const match of script.body.text.matchAll(importPattern)) {
    const name = match[1];

    if (name) {
      names.add(name);
    }
  }

  return names;
}
