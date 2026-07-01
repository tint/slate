import type {
  JsonObject,
  PreparePublishConfig,
  PreparePublishError,
  RewriteSummary,
  WorkspaceContext,
} from "./types";

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export type RewritePackageJsonResult = {
  packageJson: JsonObject;
  rewrites: RewriteSummary[];
  errors: PreparePublishError[];
};

export function rewritePackageJson(
  packageName: string,
  packageJson: JsonObject,
  config: PreparePublishConfig,
  catalog: Record<string, string>,
  workspace: WorkspaceContext | undefined,
): RewritePackageJsonResult {
  const next = structuredClone(packageJson) as JsonObject;
  const rewrites: RewriteSummary[] = [];
  const errors: PreparePublishError[] = [];

  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = next[field];

    if (!isStringRecord(dependencies)) {
      continue;
    }

    for (const [name, range] of Object.entries(dependencies)) {
      const path = `${field}.${name}`;
      const rewritten = rewriteDependencyRange(packageName, path, name, range, config, catalog, workspace, errors);

      if (rewritten !== range) {
        dependencies[name] = rewritten;
        rewrites.push({
          field,
          name,
          from: range,
          to: rewritten,
        });
      }
    }
  }

  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = next[field];

    if (!isStringRecord(dependencies)) {
      continue;
    }

    for (const [name, range] of Object.entries(dependencies)) {
      if (range.startsWith("catalog:") || range.startsWith("workspace:")) {
        errors.push({
          packageName,
          path: `${field}.${name}`,
          value: range,
          message: `${packageName} ${field}.${name} still uses unsupported publish protocol "${range}".`,
        });
      }
    }
  }

  for (const field of config.metadata.remove) {
    delete next[field];
  }

  return {
    packageJson: next,
    rewrites,
    errors,
  };
}

function rewriteDependencyRange(
  packageName: string,
  path: string,
  dependencyName: string,
  range: string,
  config: PreparePublishConfig,
  catalog: Record<string, string>,
  workspace: WorkspaceContext | undefined,
  errors: PreparePublishError[],
): string {
  if (range.startsWith("catalog:")) {
    if (config.dependencies.catalog === "error") {
      errors.push({
        packageName,
        path,
        value: range,
        message: `${packageName} ${path} uses "${range}" but catalog protocol is disabled.`,
      });
      return range;
    }

    const catalogName = range === "catalog:" ? dependencyName : range.slice("catalog:".length);
    const catalogRange = catalog[catalogName];

    if (!catalogRange) {
      errors.push({
        packageName,
        path,
        value: range,
        message: `${packageName} ${path} uses "${range}" but catalog has no "${catalogName}" entry.`,
      });
      return range;
    }

    return catalogRange;
  }

  if (range.startsWith("workspace:")) {
    if (config.dependencies.workspace === "error") {
      errors.push({
        packageName,
        path,
        value: range,
        message: `${packageName} ${path} uses "${range}" but workspace protocol is disabled.`,
      });
      return range;
    }

    if (!workspace) {
      errors.push({
        packageName,
        path,
        value: range,
        message: `${packageName} ${path} uses "${range}" but workspace protocol is only supported in workspace context.`,
      });
      return range;
    }

    const workspacePackage = workspace.packages.get(dependencyName);

    if (!workspacePackage) {
      errors.push({
        packageName,
        path,
        value: range,
        message: `${packageName} ${path} uses "${range}" but ${dependencyName} was not found in the workspace.`,
      });
      return range;
    }

    const version = workspacePackage.version;
    const workspaceRange = range.slice("workspace:".length);

    if (!version) {
      errors.push({
        packageName,
        path,
        value: range,
        message: `${packageName} ${path} uses "${range}" but ${dependencyName} has no version.`,
      });
      return range;
    }

    if (workspaceRange === "*") {
      return version;
    }

    if (workspaceRange === "^" || workspaceRange === "~") {
      return `${workspaceRange}${version}`;
    }

    if (workspaceRange) {
      return workspaceRange;
    }

    errors.push({
      packageName,
      path,
      value: range,
      message: `${packageName} ${path} uses invalid empty workspace range.`,
    });
  }

  return range;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string");
}
