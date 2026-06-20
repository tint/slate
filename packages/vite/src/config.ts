import { resolve } from "node:path";
import type { InlineConfig } from "vite";
import type { NormalizedInput, SlateViteInput, SlateViteUserConfig } from "./types";

/** Resolve user-facing input config into absolute file paths. */
export function normalizeInputs(root: string, input: SlateViteInput): NormalizedInput[] {
  if (typeof input === "string") {
    return [{
      name: "index",
      path: resolve(root, input),
    }];
  }

  return Object.entries(input).map(([name, path]) => ({
    name,
    path: resolve(root, path),
  }));
}

/** Map `/` and named routes to configured Slate inputs. */
export function routeForPath(pathname: string, inputs: NormalizedInput[]): NormalizedInput | undefined {
  if (pathname === "/") {
    return inputs[0];
  }

  const name = pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  return inputs.find((input) => input.name === name);
}

/**
 * Strip fields Slate owns before merging with internal Vite config.
 *
 * This prevents `vite.plugins` or `vite.configFile` from creating a second,
 * hidden plugin/config entrypoint that `slate check` and language tools cannot
 * reason about.
 */
export function normalizeUserViteConfig(config: SlateViteUserConfig | undefined): InlineConfig {
  if (!config) {
    return {};
  }

  const {
    plugins: _plugins,
    configFile: _configFile,
    ...rest
  } = config as InlineConfig;

  return rest;
}
