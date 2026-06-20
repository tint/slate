import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

type JsonRecord = Record<string, unknown>;
const execFileAsync = promisify(execFile);

export type PackageInfo = {
  absolutePath: string;
  relativePath: string;
  packageJsonPath: string;
  name: string;
  version: string;
  json: JsonRecord;
};

export type BumpPlan = {
  pkg: PackageInfo;
  nextVersion: string;
  changelog: string[];
};

export type BumpKind = "patch" | "minor" | "major" | "prepatch" | "preminor" | "premajor" | "custom";

export async function findWorkspaceRoot(start: string): Promise<string> {
  let current = path.resolve(start);

  while (true) {
    const packageJsonPath = path.join(current, "package.json");

    if (existsSync(packageJsonPath)) {
      const json = await readJson(packageJsonPath);
      if (Array.isArray(json.workspaces)) {
        return current;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("Cannot find workspace root package.json.");
    }

    current = parent;
  }
}

export async function assertPackageReadyForBump(root: string, pkg: PackageInfo): Promise<void> {
  await assertWorkspaceRootIsGitRepository(root);

  const dirty = await collectPackageStatus(root, pkg);
  if (dirty.length) {
    throw new Error(
      [
        `Cannot bump ${pkg.name} because it has uncommitted package files:`,
        ...dirty.map((line) => `  ${line}`),
        "Commit or discard these changes before running bump.",
      ].join("\n"),
    );
  }
}

export async function findBumpPackages(root: string): Promise<PackageInfo[]> {
  const rootPackageJsonPath = path.join(root, "package.json");
  const rootJson = await readJson(rootPackageJsonPath);
  const workspaces = Array.isArray(rootJson.workspaces) ? rootJson.workspaces.filter(isString) : [];
  const packageJsonPaths = await expandWorkspacePackageJsons(root, workspaces);
  const packages: PackageInfo[] = [];
  const rootName = typeof rootJson.name === "string" ? rootJson.name : "";

  if (rootName) {
    packages.push({
      absolutePath: root,
      relativePath: ".",
      packageJsonPath: rootPackageJsonPath,
      name: rootName,
      version: typeof rootJson.version === "string" ? rootJson.version : "0.0.0",
      json: rootJson,
    });
  }

  for (const packageJsonPath of packageJsonPaths) {
    const json = await readJson(packageJsonPath);
    const name = typeof json.name === "string" ? json.name : "";
    const version = typeof json.version === "string" ? json.version : "0.0.0";
    const absolutePath = path.dirname(packageJsonPath);
    const relativePath = path.relative(root, absolutePath);

    if (!name) {
      continue;
    }

    packages.push({
      absolutePath,
      relativePath,
      packageJsonPath,
      name,
      version,
      json,
    });
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

export async function applyBumpPlan(root: string, plans: BumpPlan[]): Promise<void> {
  const changedVersions = new Map(plans.map((plan) => [plan.pkg.name, plan.nextVersion]));

  for (const plan of plans) {
    await updatePackageVersion(plan.pkg, plan.nextVersion);
    await updateJsrVersion(plan.pkg.absolutePath, plan.nextVersion);
    await appendChangelog(plan.pkg.absolutePath, plan.nextVersion, plan.changelog);
  }

  await updateWorkspaceDependencyRanges(root, changedVersions);
}

export async function collectPackageChangelog(root: string, pkg: PackageInfo): Promise<string[]> {
  const tag = await findPackageVersionTag(root, pkg);
  const range = tag ? [`${tag}..HEAD`] : [];
  const paths = packagePathspecs(pkg);
  const args = ["log", "--format=%s", ...range, "--", ...paths];

  try {
    const { stdout } = await execFileAsync("git", args, { cwd: root });
    return uniqueLines(stdout.split("\n").map(cleanCommitSubject).filter(Boolean));
  } catch {
    return [];
  }
}

async function expandWorkspacePackageJsons(root: string, patterns: string[]): Promise<string[]> {
  const paths = new Set<string>();

  for (const pattern of patterns) {
    if (!pattern.endsWith("/*")) {
      const packageJsonPath = path.join(root, pattern, "package.json");
      if (existsSync(packageJsonPath)) {
        paths.add(packageJsonPath);
      }
      continue;
    }

    const base = path.join(root, pattern.slice(0, -2));
    if (!existsSync(base)) {
      continue;
    }

    for (const entry of await readdir(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const packageJsonPath = path.join(base, entry.name, "package.json");
      if (existsSync(packageJsonPath)) {
        paths.add(packageJsonPath);
      }
    }
  }

  return Array.from(paths).sort();
}

async function updatePackageVersion(pkg: PackageInfo, version: string): Promise<void> {
  pkg.json.version = version;
  await writeJson(pkg.packageJsonPath, pkg.json);
}

async function updateJsrVersion(packageDir: string, version: string): Promise<void> {
  const jsrPath = path.join(packageDir, "jsr.json");

  if (!existsSync(jsrPath)) {
    return;
  }

  const json = await readJson(jsrPath);
  json.version = version;
  await writeJson(jsrPath, json);
}

async function appendChangelog(packageDir: string, version: string, entries: string[]): Promise<void> {
  const changelogPath = path.join(packageDir, "CHANGELOG.md");
  const date = new Date().toISOString().slice(0, 10);
  const body = entries.map((entry) => `- ${entry}`).join("\n");
  const section = `## ${version} - ${date}\n\n${body}\n\n`;

  if (!existsSync(changelogPath)) {
    await writeFile(changelogPath, `# Changelog\n\n${section}`);
    return;
  }

  const current = await readFile(changelogPath, "utf8");
  const next = current.startsWith("# Changelog\n\n")
    ? current.replace("# Changelog\n\n", `# Changelog\n\n${section}`)
    : `# Changelog\n\n${section}${current}`;

  await writeFile(changelogPath, next);
}

async function updateWorkspaceDependencyRanges(root: string, versions: Map<string, string>): Promise<void> {
  const rootJson = await readJson(path.join(root, "package.json"));
  const workspaces = Array.isArray(rootJson.workspaces) ? rootJson.workspaces.filter(isString) : [];
  const packageJsonPaths = await expandWorkspacePackageJsons(root, workspaces);

  for (const packageJsonPath of packageJsonPaths) {
    const json = await readJson(packageJsonPath);
    let changed = false;

    for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      const deps = json[field];
      if (!isRecord(deps)) {
        continue;
      }

      for (const [name, version] of versions) {
        if (typeof deps[name] === "string" && deps[name].startsWith("workspace:")) {
          deps[name] = `workspace:^${version}`;
          changed = true;
        }
      }
    }

    if (changed) {
      await writeJson(packageJsonPath, json);
    }
  }
}

async function readJson(file: string): Promise<JsonRecord> {
  return JSON.parse(await readFile(file, "utf8")) as JsonRecord;
}

async function writeJson(file: string, json: JsonRecord): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(json, null, 2)}\n`);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function assertWorkspaceRootIsGitRepository(root: string): Promise<void> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd: root });
    const gitRoot = path.resolve(stdout.trim());

    if (gitRoot !== path.resolve(root)) {
      throw new Error(`Workspace root is not the git repository root: ${root}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Workspace root is not")) {
      throw error;
    }

    throw new Error(`Workspace root must be a git repository: ${root}`);
  }
}

async function collectPackageStatus(root: string, pkg: PackageInfo): Promise<string[]> {
  const { stdout } = await execFileAsync("git", ["status", "--porcelain", "--", ...packagePathspecs(pkg)], { cwd: root });
  return stdout.split("\n").map((line) => line.trimEnd()).filter(Boolean);
}

function packagePathspecs(pkg: PackageInfo): string[] {
  return pkg.relativePath === "."
    ? [".", ":(exclude)packages", ":(exclude)internal"]
    : [pkg.relativePath];
}

async function findPackageVersionTag(root: string, pkg: PackageInfo): Promise<string | undefined> {
  const candidates = [
    `${pkg.name}@${pkg.version}`,
    `${pkg.name}@v${pkg.version}`,
    `${pkg.name.replace(/^@/, "").replace("/", "-")}@${pkg.version}`,
    `${pkg.name.replace(/^@/, "").replace("/", "-")}@v${pkg.version}`,
  ];

  for (const tag of candidates) {
    try {
      await execFileAsync("git", ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`], { cwd: root });
      return tag;
    } catch {
      continue;
    }
  }

  return undefined;
}

function cleanCommitSubject(subject: string): string {
  return subject.trim();
}

function uniqueLines(lines: string[]): string[] {
  return Array.from(new Set(lines));
}
