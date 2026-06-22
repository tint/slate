import ts from "typescript";
import path from "node:path";
import {
  CompletionItemKind,
  InsertTextFormat,
  SymbolKind,
  type CompletionItem,
  type CompletionList,
  type Hover,
  type Location,
  type Position,
  type Range as LspRange,
} from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";
import {
  createSlateLanguageServiceHost,
  createSlateVirtualDocument,
  isSlateModuleVirtualFile,
  SLATE_TYPE_SCRIPT_COMPILER_OPTIONS,
  toOriginalOffset,
  toOriginalSlateModuleFilename,
  toVirtualOffset,
  type SlateVirtualDocument,
} from "@slate/ts-plugin";

export type SymbolEntry = {
  name: string;
  range: { start: number; end: number };
  detail?: string;
  completionKind?: CompletionItemKind;
  symbolKind?: SymbolKind;
};

export type TypeScriptContext = {
  service: ts.LanguageService;
  virtualDocument: SlateVirtualDocument;
};

export type ReadOpenDocumentByFilename = (filename: string) => string | undefined;

export function createTypeScriptContext(
  document: TextDocument,
  readOpenDocumentByFilename: ReadOpenDocumentByFilename,
): TypeScriptContext {
  const filename = uriToFilename(document.uri);
  const virtualDocument = createSlateVirtualDocument(document.getText(), filename);
  const host = createSlateLanguageServiceHost({
    virtualDocument,
    compilerOptions: SLATE_TYPE_SCRIPT_COMPILER_OPTIONS,
    readSlateSource: (slateFilename) => readOpenDocumentByFilename(slateFilename),
  });

  return {
    service: ts.createLanguageService(host, ts.createDocumentRegistry()),
    virtualDocument,
  };
}

export function completionFromTypeScriptContext(
  context: TypeScriptContext,
  document: TextDocument,
  position: Position,
): CompletionList {
  const slateItems = slateCompletionItems(document, position);
  const offset = virtualOffsetAt(context, document, position);

  if (offset === undefined) {
    return {
      isIncomplete: false,
      items: slateItems,
    };
  }

  const completions = context.service.getCompletionsAtPosition(context.virtualDocument.virtualFilename, offset, {
    includeCompletionsForModuleExports: true,
    includeCompletionsWithInsertText: true,
  });

  if (!completions) {
    return {
      isIncomplete: false,
      items: slateItems,
    };
  }

  return {
    isIncomplete: false,
    items: [
      ...slateItems,
      ...completions.entries.map((entry): CompletionItem => ({
        label: entry.name,
        kind: completionItemKindFromScriptElementKind(entry.kind),
        detail: entry.sourceDisplay ? ts.displayPartsToString(entry.sourceDisplay) : undefined,
        sortText: entry.sortText,
        insertText: entry.insertText,
      })),
    ],
  };
}

function slateCompletionItems(document: TextDocument, position: Position): CompletionItem[] {
  const source = document.getText();
  const offset = document.offsetAt(position);
  const prefix = source.slice(Math.max(0, offset - 12), offset);

  if (/\{\#$/.test(prefix)) {
    return [
      slateSnippet("#if", "if ${1:condition}}\n  $0\n{/if}", "Slate if block"),
      slateSnippet("#each", "each ${1:items} as ${2:item}}\n  $0\n{/each}", "Slate each block"),
      slateSnippet("#await", "await ${1:promise}}\n  $0\n{:then ${2:value}}\n  \n{:catch ${3:error}}\n  \n{/await}", "Slate await block"),
    ];
  }

  if (/\{@$/.test(prefix)) {
    return [
      slateSnippet("@html", "html ${1:expression}}", "Render trusted raw HTML"),
      slateSnippet("@debug", "debug ${1:expression}}", "Emit debug information"),
    ];
  }

  if (/\{$/.test(prefix)) {
    return [
      slateSnippet("{#if}", "#if ${1:condition}}\n  $0\n{/if}", "Slate if block"),
      slateSnippet("{#each}", "#each ${1:items} as ${2:item}}\n  $0\n{/each}", "Slate each block"),
      slateSnippet("{#await}", "#await ${1:promise}}\n  $0\n{/await}", "Slate await block"),
      slateSnippet("{@html}", "@html ${1:expression}}", "Render trusted raw HTML"),
      slateSnippet("{@debug}", "@debug ${1:expression}}", "Emit debug information"),
      slateSnippet("{const}", "const ${1:name} = ${2:expression}}", "Template-local constant"),
      slateSnippet("{let}", "let ${1:name} = ${2:expression}}", "Template-local mutable binding"),
    ];
  }

  if (/\$$/.test(prefix)) {
    return [
      slateSnippet("$prop", 'prop("${1:name}", ${2:defaultValue})', "Declare one component prop"),
      slateSnippet("$props", "props(${1:defaults})", "Declare multiple component props"),
      slateSnippet("$inject", 'inject("${1:key}", ${2:fallback})', "Inject a context value"),
      slateSnippet("$provide", 'provide("${1:key}", ${2:value})', "Provide a context value"),
      slateSnippet("$slot", 'slot${1:<{ title: string }>}("${2:name}")', "Declare a render function for one slot"),
    ];
  }

  if (/slot:$/.test(prefix)) {
    return [
      slateSnippet("slot:name", "${1:name}={{ ${2:data} }}", "Provide content for a named slot"),
      slateSnippet("slot:default", "default", "Provide default slot content"),
      slateSnippet("slot:header", "header={{ ${1:data} }}", "Provide header slot content"),
    ];
  }

  if (/is:$/.test(prefix)) {
    return [
      slateSnippet("is:inline", "inline", "Force this script/style block to be retained inline"),
      slateSnippet("is:global", "global", "Mark this script/style block as globally retained for tree-shaking"),
    ];
  }

  if (/\bclass=$/.test(prefix)) {
    return [
      slateSnippet("class={...}", "{[${1:\"class-name\"}, { ${2:active}: ${3:condition} }]}", "Slate class accepts clsx-compatible values"),
    ];
  }

  if (/\bstyle=$/.test(prefix)) {
    return [
      slateSnippet("style={...}", "{{ ${1:color}: ${2:\"red\"} }}", "Slate style accepts string, object, or arrays"),
    ];
  }

  if (/<$/.test(prefix)) {
    return [
      slateSnippet("Fragment", "Fragment>\n  $0\n</Fragment>", "Group template children without emitting a wrapper element"),
      slateSnippet("slot", 'slot name="${1:default}" data={{ ${2:data} }} />', "Declare a slot outlet"),
      slateSnippet("script slate", "script slate>\n  $0\n</script>", "Declare Slate compile-time TSX"),
    ];
  }

  return [];
}

function slateSnippet(label: string, insertText: string, detail: string): CompletionItem {
  return {
    label,
    detail,
    kind: CompletionItemKind.Snippet,
    insertText,
    insertTextFormat: InsertTextFormat.Snippet,
    sortText: `0_${label}`,
  };
}

export function hoverFromTypeScriptContext(
  context: TypeScriptContext,
  document: TextDocument,
  position: Position,
): Hover | null {
  const slateHover = slateSyntaxHover(document, position);
  const typeScriptHover = typeScriptHoverFromContext(context, document, position);

  if (slateHover && typeScriptHover) {
    if (slateHover.slatePriority === "primary") {
      return mergeHovers(slateHover, typeScriptHover);
    }

    return mergeHovers(typeScriptHover, slateHover);
  }

  return slateHover ?? typeScriptHover;
}

function typeScriptHoverFromContext(
  context: TypeScriptContext,
  document: TextDocument,
  position: Position,
): Hover | null {
  const offset = virtualOffsetAt(context, document, position);

  if (offset === undefined) {
    return null;
  }

  const quickInfo = context.service.getQuickInfoAtPosition(context.virtualDocument.virtualFilename, offset);

  if (!quickInfo) {
    return null;
  }

  const display = ts.displayPartsToString(quickInfo.displayParts);
  const documentation = ts.displayPartsToString(quickInfo.documentation);
  const range = lspRangeFromVirtualTextSpan(context, document, quickInfo.textSpan);

  return {
    range,
    contents: {
      kind: "markdown",
      value: [`\`\`\`ts\n${display}\n\`\`\``, documentation].filter(Boolean).join("\n\n"),
    },
  };
}

function mergeHovers(primary: Hover, secondary: Hover): Hover {
  return {
    range: primary.range ?? secondary.range,
    contents: {
      kind: "markdown",
      value: [hoverMarkdown(primary), hoverMarkdown(secondary)].filter(Boolean).join("\n\n---\n\n"),
    },
  };
}

function hoverMarkdown(hover: Hover): string {
  const contents = hover.contents;

  if (typeof contents === "string") {
    return contents;
  }

  if (Array.isArray(contents)) {
    return contents.map((content) => typeof content === "string" ? content : content.value).join("\n\n");
  }

  return contents.value;
}

type SlateHoverDoc = {
  label: string;
  signature?: string;
  description: string;
  example?: string;
};

type SlateHover = Hover & {
  slatePriority?: "primary";
};

const RUNE_HOVER_DOCS: Record<string, SlateHoverDoc> = {
  $prop: {
    label: "$prop",
    signature: "$prop<T>(name: string, defaultValue?: T): T",
    description: "Declares a single component prop and returns the provided value or the default value.",
    example: 'const title = $prop("title", "Untitled");',
  },
  $props: {
    label: "$props",
    signature: "$props<T extends Record<string, unknown>>(defaults?: Partial<T>): T",
    description: "Declares multiple component props by merging incoming props over default values.",
    example: 'const props = $props<{ title: string }>({ title: "Untitled" });',
  },
  $inject: {
    label: "$inject",
    signature: "$inject<T>(key: string | symbol, fallback?: T): T",
    description: "Reads a context value provided by an ancestor component. Injected values are shared by reference.",
    example: 'const theme = $inject("theme", "light");',
  },
  $provide: {
    label: "$provide",
    signature: "$provide<T>(key: string | symbol, value: T): void",
    description: "Provides a context value to descendant components. Values are shared by reference.",
    example: '$provide("theme", "dark");',
  },
  $slot: {
    label: "$slot",
    signature: "$slot<T>(name: string, defaultData?: T): (data: T) => RenderResult",
    description: "Declares a slot render function. Use a static slot name; write `$slot(\"default\")` for the default slot.",
    example: 'const header = $slot<{ title: string }>("header");\n\n{header({ title })}',
  },
};

const TEMPLATE_HOVER_DOCS: Record<string, SlateHoverDoc> = {
  "#if": {
    label: "{#if ...}",
    signature: "{#if condition} ... {:else} ... {/if}",
    description: "Conditionally renders template content when the expression is truthy.",
    example: "{#if items.length > 0}\n  <ul>...</ul>\n{:else}\n  <p>No items</p>\n{/if}",
  },
  ":else": {
    label: "{:else}",
    signature: "{:else}",
    description: "Declares the fallback branch for an enclosing if, each, or await block.",
  },
  "#each": {
    label: "{#each ...}",
    signature: "{#each items as item, index} ... {/each}",
    description: "Iterates over an iterable or array-like value and renders the block for each item.",
    example: "{#each items as item, index}\n  <li>{index}: {item}</li>\n{/each}",
  },
  "/each": {
    label: "{/each}",
    signature: "{/each}",
    description: "Closes an each block.",
  },
  "/if": {
    label: "{/if}",
    signature: "{/if}",
    description: "Closes an if block.",
  },
  "#await": {
    label: "{#await ...}",
    signature: "{#await promise} ... {:then value} ... {:catch error} ... {/await}",
    description: "Renders async states for a promise-like expression.",
  },
  ":then": {
    label: "{:then ...}",
    signature: "{:then value}",
    description: "Declares the fulfilled branch of an await block and optionally binds the resolved value.",
  },
  ":catch": {
    label: "{:catch ...}",
    signature: "{:catch error}",
    description: "Declares the rejected branch of an await block and optionally binds the rejection reason.",
  },
  "/await": {
    label: "{/await}",
    signature: "{/await}",
    description: "Closes an await block.",
  },
  "@html": {
    label: "{@html ...}",
    signature: "{@html expression}",
    description: "Renders an expression as raw HTML. Use only with trusted content.",
  },
  "@debug": {
    label: "{@debug ...}",
    signature: "{@debug expression}",
    description: "Emits compile-time/debug information for the provided expression.",
  },
  "const": {
    label: "{const ...}",
    signature: "{const name = expression}",
    description: "Declares a template-local constant.",
  },
  "let": {
    label: "{let ...}",
    signature: "{let name = expression}",
    description: "Declares a template-local mutable binding.",
  },
  "as": {
    label: "as",
    signature: "{#each items as item, index}",
    description: "Introduces the item binding, and optionally the index binding, in an each block.",
  },
};

const SLOT_HOVER_DOCS: Record<string, SlateHoverDoc> = {
  "slot.element": {
    label: "<slot>",
    signature: '<slot name="header" data={{ title }} />',
    description: "Declares a slot outlet. Parent components can provide content with the matching `slot:name` directive.",
    example: '<slot name="header" data={{ title, icon }} />',
  },
  "slot.name": {
    label: "slot name",
    signature: 'name="header"',
    description: "Names the slot outlet. If omitted, the outlet uses the `default` slot.",
    example: '<slot name="header" />',
  },
  "slot.data": {
    label: "slot data",
    signature: "data={{ title, icon }}",
    description: "Passes outlet data to the slot content by reference. Consumers receive it through `slot:name={...}` destructuring.",
    example: '<slot name="header" data={{ title, icon }} />',
  },
  "slot.directive": {
    label: "slot:*",
    signature: "<header slot:header={{ title, icon }}>...</header>",
    description: "Provides content for a named slot on a child component. The directive name after `slot:` selects the outlet.",
    example: "<Card>\n  <header slot:header={{ title, icon }}>{title}</header>\n</Card>",
  },
};

const SCRIPT_HOVER_DOCS: Record<string, SlateHoverDoc> = {
  "script.element": {
    label: "<script slate>",
    signature: "<script slate> ... </script>",
    description: "Declares Slate compile-time TSX code. Runtime values defined here are available to the template during compilation.",
    example: '<script slate>\n  const title = $prop("title", "Slate DX");\n  const badge = <strong>{title}</strong>;\n</script>',
  },
  "script.slate": {
    label: "slate",
    signature: "<script slate>",
    description: "Marks this script block as Slate compile-time TSX. JSX inside the block produces Slate-rendered HTML.",
    example: '<script slate>\n  export type Props = { title?: string };\n  const title = $prop("title", "Untitled");\n</script>',
  },
};

const ATTRIBUTE_HOVER_DOCS: Record<string, SlateHoverDoc> = {
  "is.directive": {
    label: "is:*",
    signature: "<style is:global>...</style>\n<script is:inline>...</script>",
    description: "`is:` is a compiler directive namespace for script/style retention and tree-shaking behavior.",
    example: "<style is:global>\n  :root { color-scheme: light; }\n</style>",
  },
  "class.attribute": {
    label: "class",
    signature: 'class={["card", { active }]}\nclass="card"',
    description: "Slate class accepts clsx-compatible values: strings, arrays, objects, and nested combinations.",
    example: '<section class={["card", { active: isActive }]} />',
  },
  "style.attribute": {
    label: "style",
    signature: 'style="color: red"\nstyle={{ color: "red" }}\nstyle={[baseStyle, overrideStyle]}',
    description: "Slate style accepts a string, an object, or an array of strings/objects.",
    example: '<section style={[{ color: "red" }, extraStyle]} />',
  },
  "fragment.element": {
    label: "<Fragment>",
    signature: "<Fragment> ... </Fragment>",
    description: "Groups multiple template children without emitting an extra DOM wrapper.",
    example: "<Fragment>\n  <h1>{title}</h1>\n  <p>{description}</p>\n</Fragment>",
  },
};

function slateSyntaxHover(document: TextDocument, position: Position): SlateHover | null {
  const source = document.getText();
  const offset = document.offsetAt(position);
  const componentImportHover = slateComponentImportHover(document, offset);

  if (componentImportHover) {
    return componentImportHover;
  }

  const componentTagHover = slateComponentTagHover(document, offset);

  if (componentTagHover) {
    return componentTagHover;
  }

  const token = slateHoverTokenAt(source, offset);

  if (!token) {
    return null;
  }

  const doc =
    RUNE_HOVER_DOCS[token.text] ??
    TEMPLATE_HOVER_DOCS[token.text] ??
    SLOT_HOVER_DOCS[token.text] ??
    SCRIPT_HOVER_DOCS[token.text] ??
    ATTRIBUTE_HOVER_DOCS[token.text];

  if (!doc) {
    return null;
  }

  return {
    range: {
      start: document.positionAt(token.start),
      end: document.positionAt(token.end),
    },
    contents: {
      kind: "markdown",
      value: formatSlateHoverDoc(doc),
    },
  };
}

function slateComponentImportHover(document: TextDocument, offset: number): SlateHover | null {
  const source = document.getText();

  for (const item of importedTemplateComponents(source)) {
    const { name, specifier, nameStart, nameEnd } = item;

    if (offset < nameStart || offset > nameEnd || !specifier.endsWith(".slate")) {
      continue;
    }

    return {
      slatePriority: "primary",
      range: {
        start: document.positionAt(nameStart),
        end: document.positionAt(nameEnd),
      },
      contents: {
        kind: "markdown",
        value: formatSlateHoverDoc({
          label: `Slate component ${name}`,
          signature: `import ${name} from ${JSON.stringify(specifier)}`,
          description: "Imports a `.slate` component. Use it as a template element and pass props with attributes.",
          example: `<${name} title="Hello">\n  <p>Content</p>\n</${name}>`,
        }),
      },
    };
  }

  return null;
}

function slateComponentTagHover(document: TextDocument, offset: number): SlateHover | null {
  const source = document.getText();
  const tag = templateTagNameAt(source, offset);

  if (!tag || !isComponentTagName(tag.name)) {
    return null;
  }

  const component = importedTemplateComponents(source).find((item) => item.name === tag.name);

  if (!component) {
    return null;
  }

  const label = component.specifier.endsWith(".slate") ? `Slate component ${component.name}` : `Imported component ${component.name}`;
  const description = component.specifier.endsWith(".slate")
    ? "Renders an imported `.slate` component. Pass props with attributes and provide slots with child content."
    : "Renders an imported component-like value. Slate type checking is only specialized for `.slate` component imports.";

  return {
    slatePriority: "primary",
    range: {
      start: document.positionAt(tag.start),
      end: document.positionAt(tag.end),
    },
    contents: {
      kind: "markdown",
      value: formatSlateHoverDoc({
        label,
        signature: `<${component.name}> ... </${component.name}>`,
        description,
        example: `<${component.name} title="Hello">\n  <p>Content</p>\n</${component.name}>`,
      }),
    },
  };
}

type ImportedTemplateComponent = {
  name: string;
  specifier: string;
  nameStart: number;
  nameEnd: number;
};

export type SlateComponentTagRange = {
  name: string;
  start: number;
  end: number;
};

export function slateComponentTagRanges(source: string): SlateComponentTagRange[] {
  const importedNames = new Set(importedTemplateComponents(source).map((component) => component.name));

  if (!importedNames.size) {
    return [];
  }

  const ranges: SlateComponentTagRange[] = [];
  const tagPattern = /<\/?\s*([A-Z][\w$]*)\b[^>]*\/?>/g;

  for (const match of source.matchAll(tagPattern)) {
    const name = match[1];

    if (!name || match.index === undefined || !importedNames.has(name)) {
      continue;
    }

    const start = match.index + match[0].indexOf(name);
    ranges.push({
      name,
      start,
      end: start + name.length,
    });
  }

  return ranges;
}

function importedTemplateComponents(source: string): ImportedTemplateComponent[] {
  const components: ImportedTemplateComponent[] = [];
  const importPattern = /import\s+([^;]+?)\s+from\s+(["'])([^"']+)\2/g;

  for (const match of source.matchAll(importPattern)) {
    const clause = match[1];
    const specifier = match[3];

    if (!clause || !specifier || match.index === undefined) {
      continue;
    }

    const clauseStart = match.index + match[0].indexOf(clause);
    const defaultMatch = /^\s*([A-Za-z_$][\w$]*)/.exec(clause);

    if (defaultMatch?.[1] && isComponentTagName(defaultMatch[1])) {
      const nameStart = clauseStart + clause.indexOf(defaultMatch[1]);
      components.push({
        name: defaultMatch[1],
        specifier,
        nameStart,
        nameEnd: nameStart + defaultMatch[1].length,
      });
    }

    const namedMatch = /\{([^}]*)\}/.exec(clause);

    if (!namedMatch?.[1]) {
      continue;
    }

    const namedStart = clauseStart + clause.indexOf(namedMatch[1]);

    for (const item of namedMatch[1].split(",")) {
      const localMatch = /(?:^|\s)([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*$/.exec(item);
      const name = localMatch?.[2] ?? localMatch?.[1];

      if (!name || !isComponentTagName(name)) {
        continue;
      }

      const nameStartInNamed = namedMatch[1].indexOf(name, namedMatch[1].indexOf(item));

      if (nameStartInNamed < 0) {
        continue;
      }

      const nameStart = namedStart + nameStartInNamed;
      components.push({
        name,
        specifier,
        nameStart,
        nameEnd: nameStart + name.length,
      });
    }
  }

  return components;
}

function templateTagNameAt(source: string, offset: number): { name: string; start: number; end: number } | undefined {
  const tagStart = source.lastIndexOf("<", offset);
  const tagEnd = source.indexOf(">", tagStart);

  if (tagStart < 0 || tagEnd < offset || tagEnd < 0) {
    return undefined;
  }

  const tag = source.slice(tagStart, tagEnd + 1);
  const match = /^<\/?\s*([A-Za-z][\w:-]*)/.exec(tag);

  if (!match?.[1]) {
    return undefined;
  }

  const start = tagStart + tag.indexOf(match[1]);
  const end = start + match[1].length;

  if (offset < start || offset > end) {
    return undefined;
  }

  return {
    name: match[1],
    start,
    end,
  };
}

function isComponentTagName(name: string): boolean {
  return /^[A-Z]/.test(name);
}

function slateHoverTokenAt(source: string, offset: number): { text: string; start: number; end: number } | undefined {
  const attributeToken = attributeTokenAt(source, offset);

  if (attributeToken && ATTRIBUTE_HOVER_DOCS[attributeToken.text]) {
    return attributeToken;
  }

  const scriptToken = scriptTokenAt(source, offset);

  if (scriptToken && SCRIPT_HOVER_DOCS[scriptToken.text]) {
    return scriptToken;
  }

  const slotToken = slotTokenAt(source, offset);

  if (slotToken && SLOT_HOVER_DOCS[slotToken.text]) {
    return slotToken;
  }

  const rune = wordTokenAt(source, offset, /\$[A-Za-z_]\w*/y);

  if (rune && RUNE_HOVER_DOCS[rune.text]) {
    return rune;
  }

  const templateToken = templateTokenAt(source, offset);

  if (templateToken && TEMPLATE_HOVER_DOCS[templateToken.text]) {
    return templateToken;
  }

  return undefined;
}

function attributeTokenAt(source: string, offset: number): { text: string; start: number; end: number } | undefined {
  const tagStart = source.lastIndexOf("<", offset);
  const tagEnd = source.indexOf(">", tagStart);

  if (tagStart < 0 || tagEnd < offset || tagEnd < 0) {
    return undefined;
  }

  const tag = source.slice(tagStart, tagEnd + 1);
  const tagNameMatch = /^<\/?\s*([A-Za-z][\w:-]*)/.exec(tag);

  if (!tagNameMatch?.[1]) {
    return undefined;
  }

  const tagNameStart = tagStart + tag.indexOf(tagNameMatch[1]);
  const tagNameEnd = tagNameStart + tagNameMatch[1].length;

  if (tagNameMatch[1] === "Fragment" && offset >= tagNameStart && offset <= tagNameEnd) {
    return {
      text: "fragment.element",
      start: tagNameStart,
      end: tagNameEnd,
    };
  }

  const attributePattern = /\b(is:[A-Za-z_$][\w$-]*|class|style)\b/g;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(tag))) {
    const name = match[1];

    if (!name) {
      continue;
    }

    const start = tagStart + match.index;
    const end = start + name.length;

    if (offset < start || offset > end) {
      continue;
    }

    if (name.startsWith("is:")) {
      return {
        text: "is.directive",
        start,
        end,
      };
    }

    return {
      text: name === "class" ? "class.attribute" : "style.attribute",
      start,
      end,
    };
  }

  return undefined;
}

function scriptTokenAt(source: string, offset: number): { text: string; start: number; end: number } | undefined {
  const tagStart = source.lastIndexOf("<", offset);
  const tagEnd = source.indexOf(">", tagStart);

  if (tagStart < 0 || tagEnd < offset || tagEnd < 0) {
    return undefined;
  }

  const tag = source.slice(tagStart, tagEnd + 1);
  const tagNameMatch = /^<\s*(script)\b/.exec(tag);

  if (!tagNameMatch?.[1]) {
    return undefined;
  }

  const slateMatch = /\bslate\b/.exec(tag);

  if (!slateMatch) {
    return undefined;
  }

  const tagNameStart = tagStart + tag.indexOf(tagNameMatch[1]);
  const tagNameEnd = tagNameStart + tagNameMatch[1].length;

  if (offset >= tagNameStart && offset <= tagNameEnd) {
    return {
      text: "script.element",
      start: tagNameStart,
      end: tagNameEnd,
    };
  }

  const slateStart = tagStart + slateMatch.index;
  const slateEnd = slateStart + slateMatch[0].length;

  if (offset >= slateStart && offset <= slateEnd) {
    return {
      text: "script.slate",
      start: slateStart,
      end: slateEnd,
    };
  }

  return undefined;
}

function slotTokenAt(source: string, offset: number): { text: string; start: number; end: number } | undefined {
  const tagStart = source.lastIndexOf("<", offset);
  const tagEnd = source.indexOf(">", tagStart);

  if (tagStart < 0 || tagEnd < offset || tagEnd < 0) {
    return undefined;
  }

  const tag = source.slice(tagStart, tagEnd + 1);
  const tagNameMatch = /^<\/?\s*([A-Za-z][\w:-]*)/.exec(tag);

  if (!tagNameMatch?.[1]) {
    return undefined;
  }

  const tagNameStart = tagStart + tag.indexOf(tagNameMatch[1]);
  const tagNameEnd = tagNameStart + tagNameMatch[1].length;

  if (tagNameMatch[1] === "slot" && offset >= tagNameStart && offset <= tagNameEnd) {
    return {
      text: "slot.element",
      start: tagNameStart,
      end: tagNameEnd,
    };
  }

  const attributePattern = /\b(slot:[A-Za-z_$][\w$-]*|name|data)\b/g;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(tag))) {
    const name = match[1];

    if (!name) {
      continue;
    }

    const start = tagStart + match.index;
    const end = start + name.length;

    if (offset < start || offset > end) {
      continue;
    }

    if (name.startsWith("slot:")) {
      return {
        text: "slot.directive",
        start,
        end,
      };
    }

    if (tagNameMatch[1] !== "slot") {
      continue;
    }

    return {
      text: name === "name" ? "slot.name" : "slot.data",
      start,
      end,
    };
  }

  return undefined;
}

function templateTokenAt(source: string, offset: number): { text: string; start: number; end: number } | undefined {
  const open = source.lastIndexOf("{", offset);
  const close = source.indexOf("}", open);

  if (open < 0 || close < offset || close < 0) {
    return undefined;
  }

  const contentStart = open + 1;
  const content = source.slice(contentStart, close);
  const blockMatch = /^\s*(#if|#each|#await|:else|:then|:catch|\/if|\/each|\/await|@html|@debug|const|let)\b/.exec(content);

  if (blockMatch?.[1]) {
    const start = contentStart + blockMatch[0].indexOf(blockMatch[1]);
    const end = start + blockMatch[1].length;

    if (offset >= start && offset <= end) {
      return {
        text: blockMatch[1],
        start,
        end,
      };
    }
  }

  const asMatch = /\bas\b/g;
  let match: RegExpExecArray | null;

  while ((match = asMatch.exec(content))) {
    const start = contentStart + match.index;
    const end = start + match[0].length;

    if (offset >= start && offset <= end) {
      return {
        text: "as",
        start,
        end,
      };
    }
  }

  return undefined;
}

function wordTokenAt(
  source: string,
  offset: number,
  pattern: RegExp,
): { text: string; start: number; end: number } | undefined {
  let start = offset;
  let end = offset;

  while (start > 0 && /[$\w]/.test(source[start - 1] ?? "")) {
    start--;
  }

  while (end < source.length && /[$\w]/.test(source[end] ?? "")) {
    end++;
  }

  pattern.lastIndex = 0;
  const text = source.slice(start, end);
  const match = pattern.exec(text);

  if (!match || match[0] !== text) {
    return undefined;
  }

  return {
    text,
    start,
    end,
  };
}

function formatSlateHoverDoc(doc: SlateHoverDoc): string {
  return [
    `### ${doc.label}`,
    doc.signature ? `\`\`\`slate\n${doc.signature}\n\`\`\`` : undefined,
    doc.description,
    doc.example ? `Example:\n\`\`\`slate\n${doc.example}\n\`\`\`` : undefined,
  ].filter((part): part is string => Boolean(part)).join("\n\n");
}

export function definitionFromTypeScriptContext(
  context: TypeScriptContext,
  document: TextDocument,
  position: Position,
): Location[] | null {
  const offset = virtualOffsetAt(context, document, position);

  if (offset === undefined) {
    return definitionFromSlateComponentTag(document, position);
  }

  const definitions = context.service.getDefinitionAtPosition(context.virtualDocument.virtualFilename, offset) ?? [];
  const locations = definitions.flatMap((definition) => locationFromDefinition(context, document, definition));

  return locations.length > 0 ? locations : definitionFromSlateComponentTag(document, position);
}

function definitionFromSlateComponentTag(document: TextDocument, position: Position): Location[] | null {
  const source = document.getText();
  const offset = document.offsetAt(position);
  const tag = templateTagNameAt(source, offset);

  if (!tag || !isComponentTagName(tag.name)) {
    return null;
  }

  const component = importedTemplateComponents(source).find((item) => item.name === tag.name);

  if (!component) {
    return null;
  }

  if (component.specifier.endsWith(".slate") && component.specifier.startsWith(".")) {
    return [
      {
        uri: filenameToUri(path.resolve(path.dirname(uriToFilename(document.uri)), component.specifier)),
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
      },
    ];
  }

  return [
    {
      uri: document.uri,
      range: {
        start: document.positionAt(component.nameStart),
        end: document.positionAt(component.nameEnd),
      },
    },
  ];
}

export function scriptSymbolsFromTypeScript(document: TextDocument): SymbolEntry[] {
  const filename = uriToFilename(document.uri);
  const virtualDocument = createSlateVirtualDocument(document.getText(), filename);
  const script = virtualDocument.script;

  if (!script) {
    return [];
  }

  const sourceFile = ts.createSourceFile(
    virtualDocument.virtualFilename,
    virtualDocument.text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const symbols: SymbolEntry[] = [];
  const pushIdentifier = (identifier: ts.Identifier, symbolKind: SymbolKind): void => {
    const virtualStart = identifier.getStart(sourceFile);
    const virtualEnd = identifier.getEnd();
    const start = toOriginalOffset(virtualDocument, virtualStart);
    const end = toOriginalOffset(virtualDocument, virtualEnd);

    if (start === undefined || end === undefined) {
      return;
    }

    if (start < script.body.range.start || end > script.body.range.end) {
      return;
    }

    symbols.push({
      name: identifier.text,
      range: {
        start,
        end,
      },
      symbolKind,
    });
  };
  const pushBindingName = (bindingName: ts.BindingName, symbolKind: SymbolKind): void => {
    if (ts.isIdentifier(bindingName)) {
      pushIdentifier(bindingName, symbolKind);
      return;
    }

    for (const element of bindingName.elements) {
      if (ts.isBindingElement(element)) {
        pushBindingName(element.name, symbolKind);
      }
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node)) {
      pushBindingName(node.name, SymbolKind.Variable);
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      pushIdentifier(node.name, SymbolKind.Function);
    } else if (ts.isClassDeclaration(node) && node.name) {
      pushIdentifier(node.name, SymbolKind.Class);
    } else if (ts.isInterfaceDeclaration(node)) {
      pushIdentifier(node.name, SymbolKind.Interface);
    } else if (ts.isTypeAliasDeclaration(node)) {
      pushIdentifier(node.name, SymbolKind.TypeParameter);
    } else if (ts.isEnumDeclaration(node)) {
      pushIdentifier(node.name, SymbolKind.Enum);
    } else if (ts.isImportDeclaration(node) && node.importClause) {
      if (node.importClause.name) {
        pushIdentifier(node.importClause.name, SymbolKind.Module);
      }

      const namedBindings = node.importClause.namedBindings;

      if (namedBindings && ts.isNamespaceImport(namedBindings)) {
        pushIdentifier(namedBindings.name, SymbolKind.Module);
      } else if (namedBindings && ts.isNamedImports(namedBindings)) {
        for (const element of namedBindings.elements) {
          pushIdentifier(element.name, SymbolKind.Variable);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return symbols.sort((left, right) => left.range.start - right.range.start);
}

function virtualOffsetAt(
  context: TypeScriptContext,
  document: TextDocument,
  position: Position,
): number | undefined {
  return toVirtualOffset(context.virtualDocument, document.offsetAt(position));
}

function lspRangeFromVirtualTextSpan(
  context: TypeScriptContext,
  document: TextDocument,
  textSpan: ts.TextSpan,
): LspRange | undefined {
  const start = toOriginalOffset(context.virtualDocument, textSpan.start);
  const end = toOriginalOffset(context.virtualDocument, textSpan.start + textSpan.length);

  if (start === undefined || end === undefined) {
    return undefined;
  }

  return {
    start: document.positionAt(start),
    end: document.positionAt(end),
  };
}

function locationFromDefinition(
  context: TypeScriptContext,
  document: TextDocument,
  definition: ts.DefinitionInfo,
): Location[] {
  if (definition.fileName === context.virtualDocument.virtualFilename) {
    const start = toOriginalOffset(context.virtualDocument, definition.textSpan.start);
    const end = toOriginalOffset(context.virtualDocument, definition.textSpan.start + definition.textSpan.length);

    if (start === undefined || end === undefined) {
      return [];
    }

    return [
      {
        uri: document.uri,
        range: {
          start: document.positionAt(start),
          end: document.positionAt(end),
        },
      },
    ];
  }

  if (isSlateModuleVirtualFile(definition.fileName)) {
    return [
      {
        uri: filenameToUri(toOriginalSlateModuleFilename(definition.fileName)),
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
      },
    ];
  }

  const sourceFile = context.service.getProgram()?.getSourceFile(definition.fileName);

  if (!sourceFile) {
    return [];
  }

  const start = sourceFile.getLineAndCharacterOfPosition(definition.textSpan.start);
  const end = sourceFile.getLineAndCharacterOfPosition(definition.textSpan.start + definition.textSpan.length);

  return [
    {
      uri: filenameToUri(definition.fileName),
      range: {
        start,
        end,
      },
    },
  ];
}

function completionItemKindFromScriptElementKind(kind: string): CompletionItemKind {
  switch (kind) {
    case ts.ScriptElementKind.classElement:
    case ts.ScriptElementKind.localClassElement:
      return CompletionItemKind.Class;
    case ts.ScriptElementKind.interfaceElement:
      return CompletionItemKind.Interface;
    case ts.ScriptElementKind.typeElement:
      return CompletionItemKind.TypeParameter;
    case ts.ScriptElementKind.enumElement:
      return CompletionItemKind.Enum;
    case ts.ScriptElementKind.functionElement:
    case ts.ScriptElementKind.localFunctionElement:
    case ts.ScriptElementKind.memberFunctionElement:
      return CompletionItemKind.Function;
    case ts.ScriptElementKind.constElement:
      return CompletionItemKind.Constant;
    case ts.ScriptElementKind.letElement:
    case ts.ScriptElementKind.variableElement:
    case ts.ScriptElementKind.localVariableElement:
    case ts.ScriptElementKind.parameterElement:
      return CompletionItemKind.Variable;
    case ts.ScriptElementKind.memberVariableElement:
    case ts.ScriptElementKind.memberGetAccessorElement:
    case ts.ScriptElementKind.memberSetAccessorElement:
      return CompletionItemKind.Property;
    case ts.ScriptElementKind.keyword:
      return CompletionItemKind.Keyword;
    case ts.ScriptElementKind.moduleElement:
      return CompletionItemKind.Module;
    case ts.ScriptElementKind.alias:
      return CompletionItemKind.Reference;
    default:
      return CompletionItemKind.Text;
  }
}

function uriToFilename(uri: string): string {
  try {
    const parsed = URI.parse(uri);
    return parsed.scheme === "file" ? parsed.fsPath : uri;
  } catch {
    return uri;
  }
}

function filenameToUri(filename: string): string {
  return URI.file(filename).toString();
}
