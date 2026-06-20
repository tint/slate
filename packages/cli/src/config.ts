import { access } from "node:fs/promises";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SlatePlugin, SlateViteUserConfig } from "@slate/vite";

/** User-authored `slate.config.*` shape. */
export type SlateConfig = {
  input?: string | Record<string, string>;
  plugins?: SlatePlugin[];
  vite?: SlateViteUserConfig;
  publicDir?: string;
  dev?: {
    host?: string;
    port?: number;
    tmpDir?: string;
    reload?: boolean;
  };
  build?: {
    output?: string;
    tmpDir?: string;
  };
  preview?: {
    host?: string;
    port?: number;
  };
  kit?: {
    specifier?: string;
  };
};

/** Fully resolved config after defaults and config-relative paths are applied. */
export type ResolvedSlateConfig = {
  configPath?: string;
  input: ResolvedSlateInput[];
  plugins: SlatePlugin[];
  vite?: SlateViteUserConfig;
  publicDir?: string;
  dev: {
    host: string;
    port: number;
    tmpDir: string;
    reload: boolean;
  };
  build: {
    output?: string;
    tmpDir: string;
  };
  preview: {
    host: string;
    port: number;
  };
  kit: {
    specifier: string;
  };
};

export type ResolvedSlateInput = {
  name: string;
  path: string;
};

const DEFAULT_CONFIG: Omit<ResolvedSlateConfig, "configPath" | "input"> = {
  plugins: [],
  dev: {
    host: "127.0.0.1",
    port: 5173,
    tmpDir: "node_modules/.slate-dev",
    reload: true,
  },
  build: {
    tmpDir: "node_modules/.slate-tmp",
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  kit: {
    specifier: "@slate/kit",
  },
};

/** Type helper for `slate.config.ts`. */
export function defineConfig(config: SlateConfig): SlateConfig {
  return config;
}

/** Load Slate config, applying CLI config selection and config-relative paths. */
export async function loadConfig(configFile?: string): Promise<ResolvedSlateConfig> {
  const configPath = await findConfig(configFile);
  const userConfig = configPath ? await importConfig(configPath) : {};
  const baseDir = configPath ? dirname(configPath) : process.cwd();

  return {
    configPath,
    input: resolveInput(baseDir, userConfig.input),
    plugins: userConfig.plugins ?? [],
    vite: userConfig.vite,
    publicDir: userConfig.publicDir ? resolveConfigPath(baseDir, userConfig.publicDir) : undefined,
    dev: {
      host: userConfig.dev?.host ?? DEFAULT_CONFIG.dev.host,
      port: userConfig.dev?.port ?? DEFAULT_CONFIG.dev.port,
      tmpDir: userConfig.dev?.tmpDir ? resolveConfigPath(baseDir, userConfig.dev.tmpDir) : DEFAULT_CONFIG.dev.tmpDir,
      reload: userConfig.dev?.reload ?? DEFAULT_CONFIG.dev.reload,
    },
    build: {
      output: userConfig.build?.output ? resolveConfigPath(baseDir, userConfig.build.output) : DEFAULT_CONFIG.build.output,
      tmpDir: userConfig.build?.tmpDir ? resolveConfigPath(baseDir, userConfig.build.tmpDir) : DEFAULT_CONFIG.build.tmpDir,
    },
    preview: {
      host: userConfig.preview?.host ?? DEFAULT_CONFIG.preview.host,
      port: userConfig.preview?.port ?? DEFAULT_CONFIG.preview.port,
    },
    kit: {
      specifier: userConfig.kit?.specifier ?? DEFAULT_CONFIG.kit.specifier,
    },
  };
}

function resolveInput(baseDir: string, input: SlateConfig["input"]): ResolvedSlateInput[] {
  if (!input) {
    return [];
  }

  if (typeof input === "string") {
    return [{
      name: "index",
      path: resolveConfigPath(baseDir, input),
    }];
  }

  return Object.entries(input).map(([name, path]) => ({
    name,
    path: resolveConfigPath(baseDir, path),
  }));
}

function resolveConfigPath(baseDir: string, value: string): string {
  return isAbsolute(value) ? value : resolve(baseDir, value);
}

async function findConfig(configFile: string | undefined): Promise<string | undefined> {
  if (configFile) {
    return resolve(configFile);
  }

  for (const name of ["slate.config.ts", "slate.config.mjs", "slate.config.js"]) {
    const candidate = resolve(name);

    if (await exists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function importConfig(configPath: string): Promise<SlateConfig> {
  const mod = await importConfigModule(configPath);
  const config = mod.default ?? mod.config ?? {};

  if (!isObject(config)) {
    throw new Error(`Slate config must export an object: ${configPath}`);
  }

  return config as SlateConfig;
}

async function importConfigModule(configPath: string): Promise<Record<string, unknown>> {
  const url = pathToFileURL(configPath).href;
  const extension = extname(configPath);

  if (extension === ".ts" || extension === ".tsx" || extension === ".mts" || extension === ".cts") {
    if (isBunRuntime()) {
      return await import(url);
    }

    const { tsImport } = await import("tsx/esm/api");
    return await tsImport(url, import.meta.url);
  }

  return await import(`${url}?t=${Date.now()}`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBunRuntime(): boolean {
  return typeof process.versions.bun === "string";
}
