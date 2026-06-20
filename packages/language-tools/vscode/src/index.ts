import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import * as vscode from "vscode";
import type { ExtensionContext, OutputChannel } from "vscode";
import {
  LanguageClient,
  TransportKind,
  type Executable,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node";

const LANGUAGE_ID = "slate";
const OUTPUT_CHANNEL = "Slate";
const SERVER_ID = "slate";
const SERVER_NAME = "Slate Language Server";
const require = createRequire(import.meta.url);

let client: LanguageClient | undefined;
let outputChannel: OutputChannel | undefined;

type ServerConfig =
  | {
      kind: "module";
      module: string;
    }
  | {
      kind: "executable";
      command: string;
      args: string[];
    };

function getServerConfig(context: ExtensionContext): ServerConfig {
  const config = vscode.workspace.getConfiguration("slate");
  const command = config.get<string>("languageServer.command", "").trim();
  const configuredArgs = config.get<string[]>("languageServer.args");
  const args = Array.isArray(configuredArgs) ? configuredArgs : [];

  if (command.length > 0) {
    return {
      kind: "executable",
      command,
      args,
    };
  }

  const serverModule = resolveLanguageServerModule(context);

  if (serverModule) {
    return {
      kind: "module",
      module: serverModule,
    };
  }

  return {
    kind: "executable",
    command: "bun",
    args: [resolveLanguageServerSource(context), "--stdio"],
  };
}

function getServerOptions(context: ExtensionContext): ServerOptions {
  const config = getServerConfig(context);

  if (config.kind === "module") {
    const serverModule = {
      module: config.module,
      args: ["--stdio"],
      transport: TransportKind.stdio,
      options: {
        cwd: context.extensionPath,
        execArgv: [],
        env: process.env,
      },
    };

    return {
      run: serverModule,
      debug: {
        ...serverModule,
        options: {
          ...serverModule.options,
          env: {
            ...serverModule.options.env,
            SLATE_LANGUAGE_SERVER_DEBUG: "1",
          },
        },
      },
    };
  }

  const executable: Executable = {
    command: config.command,
    args: config.args,
    options: {
      cwd: context.extensionPath,
      env: process.env,
    },
  };

  return {
    run: executable,
    debug: {
      ...executable,
      options: {
        ...executable.options,
        env: {
          ...executable.options?.env,
          SLATE_LANGUAGE_SERVER_DEBUG: "1",
        },
      },
    },
  };
}

function resolveLanguageServerModule(context: ExtensionContext): string | undefined {
  const candidates = [
    context.asAbsolutePath(path.join("dist", "server.mjs")),
    resolvePackagePath("@slate/language-server", path.join("dist", "index.mjs")),
    context.asAbsolutePath(path.join("node_modules", "@slate", "language-server", "dist", "index.mjs")),
  ];

  return candidates.find((candidate): candidate is string => typeof candidate === "string" && existsSync(candidate));
}

function resolveLanguageServerSource(context: ExtensionContext): string {
  return (
    resolvePackagePath("@slate/language-server", path.join("src", "index.ts")) ??
    context.asAbsolutePath(path.join("node_modules", "@slate", "language-server", "src", "index.ts"))
  );
}

function resolvePackagePath(packageName: string, relativePath: string): string | undefined {
  try {
    return path.join(path.dirname(require.resolve(path.join(packageName, "package.json"))), relativePath);
  } catch {
    return undefined;
  }
}

function createClient(context: ExtensionContext): LanguageClient {
  outputChannel = outputChannel ?? vscode.window.createOutputChannel(OUTPUT_CHANNEL);

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: LANGUAGE_ID },
      { scheme: "untitled", language: LANGUAGE_ID },
    ],
    outputChannel,
  };

  return new LanguageClient(SERVER_ID, SERVER_NAME, getServerOptions(context), clientOptions);
}

export async function activate(context: ExtensionContext): Promise<void> {
  outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL);
  outputChannel.appendLine("Slate extension is activating...");

  const nextClient = createClient(context);
  client = nextClient;
  context.subscriptions.push(client, outputChannel);

  try {
    await client.start();
    outputChannel.appendLine("Slate language server started.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`Failed to start Slate language server: ${message}`);
  }
}

export async function deactivate(): Promise<void> {
  if (!client) {
    return;
  }

  await client.stop();
  client = undefined;
}
