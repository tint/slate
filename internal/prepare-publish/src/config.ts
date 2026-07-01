import type { JsonObject, PreparePublishConfig, PreparePublishOptions } from "./types";

export const defaultPreparePublishConfig: PreparePublishConfig = {
  publish: true,
  target: "jsr",
  out: ".prepare-publish",
  workspace: {
    packages: ["*"],
    exclude: ["@internal/*"],
    root: "auto",
  },
  package: {
    private: "error",
  },
  dependencies: {
    workspace: "rewrite",
    catalog: "rewrite",
  },
  metadata: {
    remove: ["private", "scripts", "devDependencies", "preparePublishConfig"],
  },
  commands: {
    before: [],
  },
};

export function readPreparePublishConfig(packageJson: JsonObject): Partial<PreparePublishConfig> {
  const value = packageJson.preparePublishConfig;
  return isRecord(value) ? value as Partial<PreparePublishConfig> : {};
}

export function resolvePreparePublishConfig(
  rootPackageJson: JsonObject | undefined,
  packageJson: JsonObject,
  options: PreparePublishOptions,
): PreparePublishConfig {
  const rootConfig = readPreparePublishConfig(rootPackageJson ?? {});

  if (rootPackageJson && rootPackageJson !== packageJson) {
    delete rootConfig.publish;
  }

  const merged = mergeConfig(
    defaultPreparePublishConfig,
    rootConfig,
    readPreparePublishConfig(packageJson),
  );

  if (options.out) {
    merged.out = options.out;
  }

  if (options.target) {
    merged.target = options.target;
  }

  normalizeCommands(merged);
  return merged;
}

function mergeConfig(...configs: Partial<PreparePublishConfig>[]): PreparePublishConfig {
  const result = structuredClone(defaultPreparePublishConfig) as PreparePublishConfig;

  for (const config of configs.slice(1)) {
    mergeInto(result as unknown as JsonObject, config as JsonObject);
  }

  return result;
}

function mergeInto(target: JsonObject, source: JsonObject): void {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }

    if (isRecord(value) && isRecord(target[key])) {
      mergeInto(target[key] as JsonObject, value);
      continue;
    }

    target[key] = value;
  }
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCommands(config: PreparePublishConfig): void {
  config.commands.before = normalizeCommandList(config.commands.before);
}

function normalizeCommandList(value: unknown): string[] {
  if (typeof value === "string") {
    return value ? [value] : [];
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  return [];
}
