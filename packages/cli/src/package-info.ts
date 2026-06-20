import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type CliPackageJson = {
  version?: string;
  dependencies?: Record<string, string>;
};

let cachedPackageJson: CliPackageJson | undefined;

export async function readCliPackageJson(): Promise<CliPackageJson> {
  if (cachedPackageJson) {
    return cachedPackageJson;
  }

  const packageJsonUrl = new URL("../package.json", import.meta.url);

  try {
    cachedPackageJson = JSON.parse(await readFile(packageJsonUrl, "utf8")) as CliPackageJson;
  } catch {
    const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), "../package.json");
    cachedPackageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as CliPackageJson;
  }

  return cachedPackageJson;
}

export function resolveCliVersion(packageJson: CliPackageJson): string {
  return packageJson.version ?? "0.0.0";
}
