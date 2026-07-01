import mapWorkspaces from "@npmcli/map-workspaces";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { detectPackageManager, exists, readJson } from "./current-package";
import type { JsonObject, WorkspaceContext, WorkspacePackage } from "./types";

type PnpmWorkspace = {
  packages?: string[];
  catalog?: Record<string, string>;
};

export async function findWorkspaceContext(start: string): Promise<WorkspaceContext | undefined> {
  const root = await findWorkspaceRoot(start);

  if (!root) {
    return undefined;
  }

  const pnpmWorkspacePath = path.join(root, "pnpm-workspace.yaml");
  const rootPackageJsonPath = path.join(root, "package.json");
  const rootPackageJson = await readJson(rootPackageJsonPath);
  const usePnpm = await exists(pnpmWorkspacePath);
  const workspaceSource = usePnpm ? await readPnpmWorkspace(pnpmWorkspacePath) : undefined;
  const workspacePackageJson = usePnpm
    ? {
      workspaces: {
        packages: workspaceSource?.packages ?? [],
      },
    }
    : rootPackageJson;
  const packageMap = await mapWorkspaces({
    cwd: root,
    pkg: workspacePackageJson,
  }) as Map<string, string>;
  const packages = new Map<string, WorkspacePackage>();
  const rootPackage = createPackage(root, root, rootPackageJson, true);

  if (rootPackage) {
    packages.set(rootPackage.name, rootPackage);
  }

  for (const [name, dir] of packageMap) {
    const absoluteDir = path.resolve(dir);
    const packageJson = await readJson(path.join(absoluteDir, "package.json"));
    const pkg = createPackage(root, absoluteDir, packageJson, false);

    if (pkg) {
      packages.set(name, pkg);
    }
  }

  return {
    root,
    source: usePnpm ? "pnpm-workspace-yaml" : "package-json",
    packageManager: detectPackageManager(root),
    rootPackage,
    packages,
    catalog: usePnpm ? workspaceSource?.catalog ?? {} : readCatalog(rootPackageJson),
  };
}

async function findWorkspaceRoot(start: string): Promise<string | undefined> {
  let current = path.resolve(start);

  while (true) {
    const packageJsonPath = path.join(current, "package.json");
    const pnpmWorkspacePath = path.join(current, "pnpm-workspace.yaml");

    if (await exists(pnpmWorkspacePath)) {
      return current;
    }

    if (await exists(packageJsonPath)) {
      const packageJson = await readJson(packageJsonPath);
      if (hasWorkspaces(packageJson)) {
        return current;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

async function readPnpmWorkspace(file: string): Promise<PnpmWorkspace> {
  const parsed = parse(await readFile(file, "utf8")) as unknown;

  if (!isRecord(parsed)) {
    return {};
  }

  return {
    packages: Array.isArray(parsed.packages) ? parsed.packages.filter(isString) : [],
    catalog: readCatalog(parsed),
  };
}

function createPackage(root: string, dir: string, packageJson: JsonObject, isRoot: boolean): WorkspacePackage | undefined {
  const name = typeof packageJson.name === "string" ? packageJson.name : "";
  const version = typeof packageJson.version === "string" ? packageJson.version : "";

  if (!name) {
    return undefined;
  }

  return {
    name,
    version,
    dir,
    relativeDir: path.relative(root, dir) || ".",
    packageJsonPath: path.join(dir, "package.json"),
    packageJson,
    private: packageJson.private === true,
    root: isRoot,
  };
}

function hasWorkspaces(packageJson: JsonObject): boolean {
  const workspaces = packageJson.workspaces;
  return Array.isArray(workspaces) || Boolean(isRecord(workspaces) && Array.isArray(workspaces.packages));
}

function readCatalog(value: unknown): Record<string, string> {
  if (!isRecord(value) || !isRecord(value.catalog)) {
    return {};
  }

  const catalog: Record<string, string> = {};
  for (const [key, item] of Object.entries(value.catalog)) {
    if (typeof item === "string") {
      catalog[key] = item;
    }
  }
  return catalog;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
