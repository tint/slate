import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { URI } from "vscode-uri";

type JsonRpcMessage = {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
};

type PendingRequest = {
  resolve: (value: JsonRpcMessage) => void;
  reject: (error: Error) => void;
};

const root = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(root, "..");
const fixturesDir = join(packageRoot, "fixtures");

async function main(): Promise<void> {
  for (const fixtureName of readdirSync(fixturesDir).sort()) {
    const fixtureDir = join(fixturesDir, fixtureName);
    const entryPath = join(fixtureDir, "entry.slate");
    const source = readFileSync(entryPath, "utf8");
    const uri = URI.file(entryPath).toString();
    const client = new LspClient(packageRoot);

    await client.start();

    await client.request("initialize", {
      processId: null,
      rootUri: URI.file(fixtureDir).toString(),
      capabilities: {},
    });
    client.notify("initialized", {});
    client.notify("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId: "slate",
        version: 1,
        text: source,
      },
    });

    const diagnostics = await client.waitForNotification("textDocument/publishDiagnostics", (params) => {
      return isRecord(params) && params.uri === uri;
    });
    const hover = await client.request("textDocument/hover", {
      textDocument: { uri },
      position: positionAt(source, source.indexOf("title.toUpperCase") + "title".length),
    });
    const definition = await client.request("textDocument/definition", {
      textDocument: { uri },
      position: positionAt(source, source.indexOf("pageTitle", source.indexOf("title={")) + "page".length),
    });
    const completion = await client.request("textDocument/completion", {
      textDocument: { uri },
      position: positionAt(source, source.indexOf("title.toUpperCase") + "title.".length),
    });
    const documentSymbol = await client.request("textDocument/documentSymbol", {
      textDocument: { uri },
    });
    const hoverComponentImport = await client.request("textDocument/hover", {
      textDocument: { uri },
      position: positionAt(source, source.indexOf("Card") + "Ca".length),
    });
    const hoverRune = await client.request("textDocument/hover", {
      textDocument: { uri },
      position: positionAt(source, source.indexOf("$prop") + "$p".length),
    });
    const hoverEach = await client.request("textDocument/hover", {
      textDocument: { uri },
      position: positionAt(source, source.indexOf("#each") + "#e".length),
    });
    const hoverSlotDirective = await client.request("textDocument/hover", {
      textDocument: { uri },
      position: positionAt(source, source.indexOf("slot:header") + "slot".length),
    });
    const semanticTokens = await client.request("textDocument/semanticTokens/full", {
      textDocument: { uri },
    });
    const slateBlockCompletion = await client.requestCompletionForSource(uri, source, `${source}\n{#`);
    const runeCompletion = await client.requestCompletionForSource(uri, source, `${source}\n$`);
    const slotCompletion = await client.requestCompletionForSource(uri, source, `${source}\n<div slot:`);

    await client.shutdown();

    const output = {
      diagnostics: normalizeDiagnostics(diagnostics.params),
      hover: normalizeHover(hover.result),
      hoverComponentImport: normalizeHover(hoverComponentImport.result),
      hoverRune: normalizeHover(hoverRune.result),
      hoverEach: normalizeHover(hoverEach.result),
      hoverSlotDirective: normalizeHover(hoverSlotDirective.result),
      definition: normalizeLocations(definition.result, fixtureDir),
      completion: normalizeCompletion(completion.result),
      slateBlockCompletion: normalizeCompletionLabels(slateBlockCompletion.result),
      runeCompletion: normalizeCompletionLabels(runeCompletion.result),
      slotCompletion: normalizeCompletionLabels(slotCompletion.result),
      semanticTokens: normalizeSemanticTokens(semanticTokens.result),
      documentSymbol: normalizeDocumentSymbols(documentSymbol.result),
    };

    mkdirSync(fixtureDir, {
      recursive: true,
    });
    writeFileSync(join(fixtureDir, "lsp.json"), `${JSON.stringify(output, null, 2)}\n`);
  }
}

class LspClient {
  private process?: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private buffer = Buffer.alloc(0);
  private readonly pending = new Map<number, PendingRequest>();
  private readonly notifications: JsonRpcMessage[] = [];
  private readonly notificationWaiters: Array<{
    method: string;
    predicate: (params: unknown) => boolean;
    resolve: (message: JsonRpcMessage) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = [];

  constructor(private readonly cwd: string) {}

  async start(): Promise<void> {
    this.process = spawn("bun", ["src/index.ts", "--stdio"], {
      cwd: this.cwd,
      stdio: "pipe",
    });
    this.process.stdout.on("data", (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.drainMessages();
    });
    this.process.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8").trim();

      if (text) {
        process.stderr.write(`${text}\n`);
      }
    });
    this.process.on("exit", (code) => {
      const error = new Error(`language server exited with code ${code ?? "unknown"}`);

      for (const pending of this.pending.values()) {
        pending.reject(error);
      }

      this.pending.clear();
    });
  }

  request(method: string, params: unknown): Promise<JsonRpcMessage> {
    const id = this.nextId++;
    this.write({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });

    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve,
        reject,
      });
    });
  }

  notify(method: string, params: unknown): void {
    this.write({
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  async requestCompletionForSource(uri: string, originalSource: string, nextSource: string): Promise<JsonRpcMessage> {
    this.notify("textDocument/didChange", {
      textDocument: {
        uri,
        version: this.nextId,
      },
      contentChanges: [
        {
          text: nextSource,
        },
      ],
    });
    const completion = await this.request("textDocument/completion", {
      textDocument: { uri },
      position: positionAt(nextSource, nextSource.length),
    });
    this.notify("textDocument/didChange", {
      textDocument: {
        uri,
        version: this.nextId,
      },
      contentChanges: [
        {
          text: originalSource,
        },
      ],
    });
    return completion;
  }

  waitForNotification(
    method: string,
    predicate: (params: unknown) => boolean,
    timeoutMs = 5000,
  ): Promise<JsonRpcMessage> {
    const existing = this.notifications.find((message) => message.method === method && predicate(message.params));

    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      this.notificationWaiters.push({
        method,
        predicate,
        resolve,
        reject,
        timeout,
      });
    });
  }

  async shutdown(): Promise<void> {
    await this.request("shutdown", null);
    this.notify("exit", {});
  }

  private write(payload: Record<string, unknown>): void {
    if (!this.process) {
      throw new Error("language server is not running");
    }

    const body = JSON.stringify(payload);
    this.process.stdin.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
  }

  private drainMessages(): void {
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");

      if (headerEnd < 0) {
        return;
      }

      const header = this.buffer.subarray(0, headerEnd).toString("ascii");
      const contentLengthMatch = /Content-Length:\s*(\d+)/i.exec(header);

      if (!contentLengthMatch?.[1]) {
        this.buffer = this.buffer.subarray(headerEnd + 4);
        continue;
      }

      const contentLength = Number(contentLengthMatch[1]);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;

      if (this.buffer.length < bodyEnd) {
        return;
      }

      const raw = this.buffer.subarray(bodyStart, bodyEnd).toString("utf8");
      this.buffer = this.buffer.subarray(bodyEnd);
      this.handleMessage(JSON.parse(raw) as JsonRpcMessage);
    }
  }

  private handleMessage(message: JsonRpcMessage): void {
    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);

      if (pending) {
        this.pending.delete(message.id);
        pending.resolve(message);
      }

      return;
    }

    this.notifications.push(message);

    for (const waiter of [...this.notificationWaiters]) {
      if (message.method !== waiter.method || !waiter.predicate(message.params)) {
        continue;
      }

      clearTimeout(waiter.timeout);
      this.notificationWaiters.splice(this.notificationWaiters.indexOf(waiter), 1);
      waiter.resolve(message);
    }
  }
}

function normalizeDiagnostics(params: unknown): unknown {
  if (!isRecord(params) || !Array.isArray(params.diagnostics)) {
    return [];
  }

  return params.diagnostics.map((diagnostic) => {
    if (!isRecord(diagnostic)) {
      return diagnostic;
    }

    return {
      message: diagnostic.message,
      range: diagnostic.range,
      severity: diagnostic.severity,
      source: diagnostic.source,
    };
  });
}

function normalizeHover(result: unknown): unknown {
  if (!isRecord(result)) {
    return result;
  }

  return {
    range: result.range,
    contents: result.contents,
  };
}

function normalizeLocations(result: unknown, fixtureDir: string): unknown {
  const locations = Array.isArray(result) ? result : result ? [result] : [];

  return locations.map((location) => {
    if (!isRecord(location) || typeof location.uri !== "string") {
      return location;
    }

    return {
      uri: relative(fixtureDir, URI.parse(location.uri).fsPath),
      range: location.range,
    };
  });
}

function normalizeCompletion(result: unknown): unknown {
  if (!isRecord(result) || !Array.isArray(result.items)) {
    return [];
  }

  const wanted = new Set(["toFixed", "toLowerCase", "toString", "toUpperCase"]);

  return result.items
    .filter((item) => isRecord(item) && typeof item.label === "string" && wanted.has(item.label))
    .map((item) => ({
      label: item.label,
      kind: item.kind,
    }));
}

function normalizeCompletionLabels(result: unknown): unknown {
  if (!isRecord(result) || !Array.isArray(result.items)) {
    return [];
  }

  return result.items
    .filter((item) => isRecord(item) && typeof item.label === "string" && /^[$#@{]|^slot:/.test(item.label))
    .map((item) => ({
      label: item.label,
      detail: item.detail,
    }));
}

function normalizeSemanticTokens(result: unknown): unknown {
  if (!isRecord(result) || !Array.isArray(result.data)) {
    return {
      dataLength: 0,
    };
  }

  return {
    dataLength: result.data.length,
    firstTokens: result.data.slice(0, 20),
  };
}

function normalizeDocumentSymbols(result: unknown): unknown {
  if (!Array.isArray(result)) {
    return [];
  }

  return result.map((symbol) => {
    if (!isRecord(symbol)) {
      return symbol;
    }

    return {
      name: symbol.name,
      kind: symbol.kind,
      range: symbol.range,
      selectionRange: symbol.selectionRange,
    };
  });
}

function positionAt(source: string, offset: number): {
  line: number;
  character: number;
} {
  let line = 0;
  let lineStart = 0;

  for (let index = 0; index < offset && index < source.length; index++) {
    if (source[index] === "\n") {
      line++;
      lineStart = index + 1;
    }
  }

  return {
    line,
    character: Math.max(0, offset - lineStart),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

await main();
