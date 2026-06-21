#!/usr/bin/env node

import {
  createConnection,
  DiagnosticSeverity,
  ProposedFeatures,
  SymbolKind,
  TextDocumentSyncKind,
  TextDocuments,
  type CompletionList,
  type Diagnostic as LspDiagnostic,
  type DocumentSymbol,
  type Hover,
  type InitializeResult,
  type Location,
  type Position,
  type SemanticTokens,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";
import type {
  Diagnostic,
  EachBlockCst,
  SlateFileCst,
  TemplateCstNode,
} from "@slate/compiler";
import { parse } from "@slate/compiler";
import { checkSource } from "@slate/check";
import {
  completionFromTypeScriptContext,
  createTypeScriptContext,
  definitionFromTypeScriptContext,
  hoverFromTypeScriptContext,
  scriptSymbolsFromTypeScript,
  slateComponentTagRanges,
  type SymbolEntry,
  type TypeScriptContext,
} from "./typescript-context";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const SEMANTIC_TOKEN_TYPES = ["keyword", "function", "property", "parameter"] as const;
const typeScriptContextCache = new Map<string, {
  version: number;
  context: TypeScriptContext;
}>();

connection.onInitialize((): InitializeResult => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    completionProvider: {
      resolveProvider: false,
      triggerCharacters: ["{", "#", "@", "$", ":"],
    },
    definitionProvider: true,
    hoverProvider: true,
    documentSymbolProvider: true,
    semanticTokensProvider: {
      legend: {
        tokenTypes: [...SEMANTIC_TOKEN_TYPES],
        tokenModifiers: [],
      },
      full: true,
      range: false,
    },
  },
  serverInfo: {
    name: "slate-language-server",
    version: "0.0.0",
  },
}));

documents.onDidChangeContent((event) => {
  clearTypeScriptContextCache();
  validateDocument(event.document);
});

documents.onDidClose((event) => {
  clearTypeScriptContextCache();
  connection.sendDiagnostics({
    uri: event.document.uri,
    diagnostics: [],
  });
});

connection.onCompletion((params): CompletionList => {
  const document = documents.get(params.textDocument.uri);

  if (!document) {
    return {
      isIncomplete: false,
      items: [],
    };
  }

  return completionFromDocument(document, params.position);
});

connection.onHover((params): Hover | null => {
  const document = documents.get(params.textDocument.uri);

  if (!document) {
    return null;
  }

  return hoverFromDocument(document, params.position);
});

connection.onDefinition((params): Location[] | null => {
  const document = documents.get(params.textDocument.uri);

  if (!document) {
    return null;
  }

  return definitionFromDocument(document, params.position);
});

connection.onDocumentSymbol((params): DocumentSymbol[] => {
  const document = documents.get(params.textDocument.uri);
  return document ? documentSymbolFromDocument(document) : [];
});

connection.languages.semanticTokens.on((params): SemanticTokens => {
  const document = documents.get(params.textDocument.uri);
  return document ? semanticTokensFromDocument(document) : { data: [] };
});

documents.listen(connection);
connection.listen();

function validateDocument(document: TextDocument): void {
  const source = document.getText();
  const result = checkSource({
    source,
    filename: uriToFilename(document.uri),
  });

  connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: toLspDiagnostics(result.diagnostics, document),
  });
}

function toLspDiagnostics(diagnostics: Diagnostic[], document: TextDocument): LspDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    range: {
      start: document.positionAt(diagnostic.range.start),
      end: document.positionAt(diagnostic.range.end),
    },
    message: diagnostic.message,
    severity: diagnostic.severity === "error" ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
    source: "slate",
  }));
}

function readOpenDocumentByFilename(filename: string): string | undefined {
  return documents.get(filenameToUri(filename))?.getText();
}

function getTypeScriptContext(document: TextDocument): TypeScriptContext {
  const cached = typeScriptContextCache.get(document.uri);

  if (cached?.version === document.version) {
    return cached.context;
  }

  cached?.context.service.dispose();

  const context = createTypeScriptContext(document, readOpenDocumentByFilename);
  typeScriptContextCache.set(document.uri, {
    version: document.version,
    context,
  });
  return context;
}

function clearTypeScriptContextCache(): void {
  for (const cached of typeScriptContextCache.values()) {
    cached.context.service.dispose();
  }

  typeScriptContextCache.clear();
}

function completionFromDocument(document: TextDocument, position: Position): CompletionList {
  const context = getTypeScriptContext(document);
  return completionFromTypeScriptContext(context, document, position);
}

function hoverFromDocument(document: TextDocument, position: Position): Hover | null {
  const context = getTypeScriptContext(document);
  return hoverFromTypeScriptContext(context, document, position);
}

function definitionFromDocument(document: TextDocument, position: Position): Location[] | null {
  const context = getTypeScriptContext(document);
  return definitionFromTypeScriptContext(context, document, position);
}

function documentSymbolFromDocument(document: TextDocument): DocumentSymbol[] {
  return [...scriptSymbolsFromTypeScript(document), ...symbolsFromSource(document.getText())].map((symbol) => {
    const range = rangeFromOffsets(document, symbol.range.start, symbol.range.end);
    return {
      name: symbol.name,
      kind: symbol.symbolKind ?? SymbolKind.Variable,
      range,
      selectionRange: range,
    };
  });
}

type SemanticTokenType = typeof SEMANTIC_TOKEN_TYPES[number];

type SemanticTokenEntry = {
  start: number;
  end: number;
  type: SemanticTokenType;
};

function semanticTokensFromDocument(document: TextDocument): SemanticTokens {
  const source = document.getText();
  const entries = collectSemanticTokenEntries(source).sort((left, right) => left.start - right.start || left.end - right.end);
  const data: number[] = [];
  let previousLine = 0;
  let previousCharacter = 0;
  let previousEnd = -1;

  for (const entry of entries) {
    if (entry.start < previousEnd || entry.end <= entry.start) {
      continue;
    }

    const start = document.positionAt(entry.start);
    const deltaLine = start.line - previousLine;
    const deltaStart = deltaLine === 0 ? start.character - previousCharacter : start.character;
    const tokenType = SEMANTIC_TOKEN_TYPES.indexOf(entry.type);

    if (tokenType < 0) {
      continue;
    }

    data.push(deltaLine, deltaStart, entry.end - entry.start, tokenType, 0);
    previousLine = start.line;
    previousCharacter = start.character;
    previousEnd = entry.end;
  }

  return { data };
}

function collectSemanticTokenEntries(source: string): SemanticTokenEntry[] {
  const entries: SemanticTokenEntry[] = [];

  collectRegexTokens(source, /\$(prop|props|inject|provide)\b/g, "function", entries);
  collectRegexTokens(source, /\bslot:[A-Za-z_$][\w$-]*/g, "property", entries);
  collectRegexTokens(source, /\bis:[A-Za-z_$][\w$-]*/g, "property", entries);
  collectRegexTokens(source, /<\/?Fragment\b/g, "keyword", entries);
  collectScriptSlateTokens(source, entries);
  collectTemplateKeywordTokens(source, entries);
  collectEachSemanticTokens(source, entries);
  collectComponentTagTokens(source, entries);

  return entries;
}

function collectRegexTokens(
  source: string,
  pattern: RegExp,
  type: SemanticTokenType,
  entries: SemanticTokenEntry[],
): void {
  for (const match of source.matchAll(pattern)) {
    if (match.index === undefined) {
      continue;
    }

    entries.push({
      start: match.index,
      end: match.index + match[0].length,
      type,
    });
  }
}

function collectScriptSlateTokens(source: string, entries: SemanticTokenEntry[]): void {
  for (const match of source.matchAll(/<script\b[^>]*\bslate\b[^>]*>/g)) {
    if (match.index === undefined) {
      continue;
    }

    const slateOffset = match[0].indexOf("slate");

    if (slateOffset >= 0) {
      entries.push({
        start: match.index + slateOffset,
        end: match.index + slateOffset + "slate".length,
        type: "keyword",
      });
    }
  }
}

function collectTemplateKeywordTokens(source: string, entries: SemanticTokenEntry[]): void {
  const pattern = /\{\s*(#if|#each|#await|:else|:then|:catch|\/if|\/each|\/await|@html|@debug|const|let)\b/g;

  for (const match of source.matchAll(pattern)) {
    const token = match[1];

    if (!token || match.index === undefined) {
      continue;
    }

    const tokenStart = match.index + match[0].indexOf(token);
    entries.push({
      start: tokenStart,
      end: tokenStart + token.length,
      type: "keyword",
    });
  }
}

function collectEachSemanticTokens(source: string, entries: SemanticTokenEntry[]): void {
  const pattern = /\{\s*#each\b[^}]*\}/g;

  for (const match of source.matchAll(pattern)) {
    if (match.index === undefined) {
      continue;
    }

    const asMatch = /\bas\s+([A-Za-z_$][\w$]*)(?:\s*,\s*([A-Za-z_$][\w$]*))?/.exec(match[0]);

    if (!asMatch?.[1]) {
      continue;
    }

    const asStart = match.index + asMatch.index;
    entries.push({
      start: asStart,
      end: asStart + "as".length,
      type: "keyword",
    });

    const itemStart = match.index + asMatch.index + asMatch[0].indexOf(asMatch[1]);
    entries.push({
      start: itemStart,
      end: itemStart + asMatch[1].length,
      type: "parameter",
    });

    if (asMatch[2]) {
      const indexStart = match.index + asMatch.index + asMatch[0].indexOf(asMatch[2], asMatch[0].indexOf(asMatch[1]) + asMatch[1].length);
      entries.push({
        start: indexStart,
        end: indexStart + asMatch[2].length,
        type: "parameter",
      });
    }
  }
}

function collectComponentTagTokens(source: string, entries: SemanticTokenEntry[]): void {
  for (const tag of slateComponentTagRanges(source)) {
    entries.push({
      start: tag.start,
      end: tag.end,
      type: "function",
    });
  }
}

function symbolsFromSource(source: string): SymbolEntry[] {
  const parsed = parse(source);
  const symbols: SymbolEntry[] = [];
  const root = parsed.cst as SlateFileCst;

  for (const child of root.children) {
    if (child.kind === "SlateScriptElement") {
      continue;
    }

    collectSymbolsFromNode(child, symbols);
  }

  return symbols;
}

function collectSymbolsFromNode(node: TemplateCstNode, symbols: SymbolEntry[]): void {
  if (node.kind === "ConstTag") {
    collectSymbolsFromStatement(node.statement.text, node.statement.range.start, symbols);
    return;
  }

  if (node.kind === "LetTag") {
    collectSymbolsFromStatement(node.statement.text, node.statement.range.start, symbols);
    return;
  }

  if (node.kind === "EachBlock") {
    collectSymbolsFromEach(node, symbols);

    for (const child of node.children) {
      collectSymbolsFromNode(child, symbols);
    }

    for (const child of node.else ?? []) {
      collectSymbolsFromNode(child, symbols);
    }

    return;
  }

  if (node.kind === "IfBlock") {
    for (const child of node.then) {
      collectSymbolsFromNode(child, symbols);
    }

    for (const child of node.else ?? []) {
      collectSymbolsFromNode(child, symbols);
    }

    return;
  }

  if (node.kind === "Element") {
    for (const child of node.children) {
      collectSymbolsFromNode(child, symbols);
    }
  }
}

function collectSymbolsFromEach(node: EachBlockCst, symbols: SymbolEntry[]): void {
  const expressionText = node.open.expression?.text ?? "";
  const expressionStart = node.open.expression?.range.start ?? node.open.range.start;
  const asMatch = /\bas\s+([A-Za-z_$][\w$]*)(?:\s*,\s*([A-Za-z_$][\w$]*))?/i.exec(expressionText);

  if (asMatch?.[1]) {
    const item = asMatch[1];
    const itemOffset =
      asMatch.index !== undefined ? asMatch.index + asMatch[0].indexOf(item) : expressionText.lastIndexOf(item);

    if (itemOffset >= 0) {
      symbols.push({
        name: item,
        range: {
          start: expressionStart + itemOffset,
          end: expressionStart + itemOffset + item.length,
        },
      });
    }
  }

  if (asMatch?.[2]) {
    const indexName = asMatch[2];
    const itemName = asMatch[1] ?? "";
    const indexOffset =
      asMatch.index !== undefined
        ? asMatch.index + asMatch[0].indexOf(indexName, asMatch[0].indexOf(itemName) + itemName.length)
        : expressionText.lastIndexOf(indexName);

    if (indexOffset >= 0) {
      symbols.push({
        name: indexName,
        range: {
          start: expressionStart + indexOffset,
          end: expressionStart + indexOffset + indexName.length,
        },
      });
    }
  }
}

function collectSymbolsFromStatement(
  text: string,
  baseOffset: number,
  symbols: SymbolEntry[],
  pattern = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
): void {
  for (const match of text.matchAll(pattern)) {
    const name = match[1];

    if (!name || match.index === undefined) {
      continue;
    }

    const nameStart = match.index + match[0].indexOf(name);
    symbols.push({
      name,
      range: {
        start: baseOffset + nameStart,
        end: baseOffset + nameStart + name.length,
      },
    });
  }
}

function rangeFromOffsets(document: TextDocument, startOffset: number, endOffset: number): DocumentSymbol["range"] {
  return {
    start: document.positionAt(startOffset),
    end: document.positionAt(endOffset),
  };
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
