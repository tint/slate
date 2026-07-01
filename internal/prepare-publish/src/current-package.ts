import { constants, existsSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { CurrentPackageContext, JsonObject, PackageManager, WorkspaceContext, WorkspacePackage } from "./types";

export async function findCurrentPackageContext(start: string, workspace: WorkspaceContext | undefined): Promise<CurrentPackageContext> {
  const packageDir = await findNearestPackageDir(start);
  const packageJsonPath = path.join(packageDir, "package.json");
  const packageJson = await readJson(packageJsonPath);
  const name = typeof packageJson.name === "string" ? packageJson.name : "";
  const version = typeof packageJson.version === "string" ? packageJson.version : "";
  const privateValue = packageJson.private === true;
  const workspaceRoot = workspace?.root ?? packageDir;
  const pkg: WorkspacePackage = {
    name,
    version,
    dir: packageDir,
    relativeDir: path.relative(workspaceRoot, packageDir) || ".",
    packageJsonPath,
    packageJson,
    private: privateValue,
    root: workspace?.root === packageDir,
  };

  return {
    packageManager: detectPackageManager(workspace?.root ?? packageDir),
    pkg,
    catalog: workspace?.catalog ?? await findNearestCatalog(packageDir),
    workspace,
  };
}

export async function findNearestPackageDir(start: string): Promise<string> {
  let current = path.resolve(start);

  while (true) {
    if (await exists(path.join(current, "package.json"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Cannot find package.json from ${start}.`);
    }

    current = parent;
  }
}

export async function findNearestCatalog(start: string): Promise<Record<string, string>> {
  let current = path.resolve(start);

  while (true) {
    const packageJsonPath = path.join(current, "package.json");
    if (await exists(packageJsonPath)) {
      const packageJson = await readJson(packageJsonPath);
      if (isStringRecord(packageJson.catalog)) {
        return packageJson.catalog;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return {};
    }

    current = parent;
  }
}

export function detectPackageManager(root: string): PackageManager {
  if (existsSync(path.join(root, "pnpm-lock.yaml"))) {
    return "pnpm";
  }

  if (existsSync(path.join(root, "bun.lock")) || existsSync(path.join(root, "bun.lockb"))) {
    return "bun";
  }

  if (existsSync(path.join(root, "yarn.lock"))) {
    return "yarn";
  }

  if (existsSync(path.join(root, "package-lock.json"))) {
    return "npm";
  }

  return "unknown";
}

export async function readJson(file: string): Promise<JsonObject> {
  return JSON.parse(await readFile(file, "utf8")) as JsonObject;
}

export async function exists(file: string): Promise<boolean> {
  try {
    await access(file, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string");
}
