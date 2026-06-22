import { readFile } from "node:fs/promises";
import type { Plugin, ResolvedConfig } from "vite";
import { compile, formatDiagnostic } from "@slate/compiler";
import type { SourceMapOption } from "@slate/compiler";
import type { SlatePluginOptions } from "./types.ts";

/**
 * Vite plugin that turns `.slate` files into SSR render modules.
 *
 * User plugins are provided separately through Slate config; this plugin owns
 * the `.slate` extension so diagnostics and generated imports remain stable.
 */
export function slate(options: SlatePluginOptions = {}): Plugin {
  let config: ResolvedConfig | undefined;

  return {
    name: "slate",
    enforce: "pre",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async transform(_code, id) {
      const filename = cleanId(id);

      if (!filename.endsWith(".slate")) {
        return null;
      }

      const source = await readFile(filename, "utf8");
      const result = compile(source, {
        filename,
        dev: options.dev,
        sourcemap: options.sourcemap ?? sourceMapOptionFromVite(config),
      });

      if (result.diagnostics.length) {
        const message = result.diagnostics
          .map((diagnostic) => formatDiagnostic(diagnostic, diagnostic.filename ? source : undefined))
          .join("\n\n");
        this.error(message);
      }

      // The compiler emits the default kit specifier. CLI integration can
      // override it for workspace tests or custom runtime packages.
      const code = options.kitSpecifier && options.kitSpecifier !== "@slate/kit"
        ? result.code.replace("\"@slate/kit\"", JSON.stringify(options.kitSpecifier))
        : result.code;

      return {
        code,
        map: result.map ?? null,
      };
    },
    handleHotUpdate(ctx) {
      if (ctx.file.endsWith(".slate")) {
        ctx.server.ws.send({
          type: "full-reload",
        });
        return [];
      }
    },
  };
}

function cleanId(id: string): string {
  return id.split("?")[0] ?? id;
}

function sourceMapOptionFromVite(config: ResolvedConfig | undefined): SourceMapOption | undefined {
  const sourcemap = config?.build.sourcemap;

  if (sourcemap === true || sourcemap === "inline" || sourcemap === "hidden") {
    return sourcemap;
  }

  return undefined;
}
