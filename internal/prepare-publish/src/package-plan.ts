import Arborist from "@npmcli/arborist";
import { minimatch } from "minimatch";
import packlist from "npm-packlist";
import { spawn } from "node:child_process";
import path from "node:path";
import { resolvePreparePublishConfig } from "./config";
import { exists, readJson } from "./current-package";
import { rewritePackageJson } from "./rewrite-package-json";
import type {
  CurrentPackageContext,
  PreparePlan,
  PreparePublishConfig,
  PreparePublishError,
  PreparePublishOptions,
  WorkspaceContext,
  WorkspacePackage,
} from "./types";

type CreatePlansInput = {
  commandCwd: string;
  current: CurrentPackageContext;
  options: PreparePublishOptions;
};

export async function createPreparePlans(input: CreatePlansInput): Promise<PreparePlan[]> {
  const targets = selectTargets(input);
  const plans: PreparePlan[] = [];

  for (const pkg of targets) {
    const config = resolvePreparePublishConfig(input.current.workspace?.rootPackage?.packageJson, pkg.packageJson, input.options);
    const errors = validateTarget(pkg, config, input.options);
    const stagingDir = path.resolve(input.commandCwd, config.out, safePackageName(pkg.name));
    if (!input.options.dryRun && errors.length === 0) {
      await runBeforeCommands(pkg, config);
    }
    const files = errors.length ? [] : await packageFiles(pkg.dir, config);
    const rewrite = rewritePackageJson(pkg.name, pkg.packageJson, config, input.current.catalog, input.current.workspace);

    plans.push({
      pkg,
      config,
      stagingDir,
      files,
      rewrittenPackageJson: rewrite.packageJson,
      rewrites: rewrite.rewrites,
      errors: [...errors, ...rewrite.errors],
    });
  }

  return plans;
}

export function safePackageName(name: string): string {
  return name.replaceAll("/", "__");
}

function selectTargets(input: CreatePlansInput): WorkspacePackage[] {
  const { current, options } = input;

  if (options.all) {
    return selectAllWorkspaceTargets(current.workspace, current, options);
  }

  if (options.targets.length > 0) {
    return selectNamedWorkspaceTargets(current.workspace, options.targets);
  }

  return [current.pkg];
}

function selectAllWorkspaceTargets(
  workspace: WorkspaceContext | undefined,
  current: CurrentPackageContext,
  options: PreparePublishOptions,
): WorkspacePackage[] {
  if (!workspace) {
    throw new Error("--all requires running inside a workspace context.");
  }

  const rootConfig = resolvePreparePublishConfig(workspace.rootPackage?.packageJson, workspace.rootPackage?.packageJson ?? {}, options);
  const packages = Array.from(workspace.packages.values());
  const selected: WorkspacePackage[] = [];

  for (const pkg of packages) {
    if (pkg.root && rootConfig.workspace.root === "include") {
      selected.push(pkg);
      continue;
    }

    if (pkg.root && rootConfig.workspace.root === "exclude") {
      continue;
    }

    if (pkg.root && rootConfig.workspace.root === "auto" && !isPublishableByDefault(pkg)) {
      continue;
    }

    if (!pkg.name || !pkg.version) {
      continue;
    }

    if (!matchesPackageFilters(pkg.name, rootConfig.workspace.packages, rootConfig.workspace.exclude)) {
      continue;
    }

    const config = resolvePreparePublishConfig(workspace.rootPackage?.packageJson, pkg.packageJson, options);
    if (config.publish === false || (pkg.private && config.package.private === "error")) {
      continue;
    }

    selected.push(pkg);
  }

  return selected.sort((a, b) => a.name.localeCompare(b.name));
}

function selectNamedWorkspaceTargets(workspace: WorkspaceContext | undefined, targets: string[]): WorkspacePackage[] {
  if (!workspace) {
    throw new Error("Package targets require running inside a workspace context.");
  }

  return targets.map((target) => {
    const pkg = workspace.packages.get(target);

    if (!pkg) {
      throw new Error(`Workspace package not found: ${target}`);
    }

    return pkg;
  });
}

function validateTarget(
  pkg: WorkspacePackage,
  config: PreparePublishConfig,
  options: PreparePublishOptions,
): PreparePublishError[] {
  const errors: PreparePublishError[] = [];

  if (!pkg.name) {
    errors.push({
      packageName: pkg.name || "<unknown>",
      path: "name",
      message: "Package has no name.",
    });
  }

  if (!pkg.version) {
    errors.push({
      packageName: pkg.name,
      path: "version",
      message: `${pkg.name} has no version.`,
    });
  }

  if (config.publish === false) {
    errors.push({
      packageName: pkg.name,
      path: "preparePublishConfig.publish",
      value: false,
      message: `${pkg.name} is marked as preparePublishConfig.publish = false.`,
    });
  }

  if (pkg.private && config.package.private === "error") {
    errors.push({
      packageName: pkg.name,
      path: "private",
      value: true,
      message: `${pkg.name} is private and cannot be prepared for publishing.`,
    });
  }

  return errors;
}

function isPublishableByDefault(pkg: WorkspacePackage): boolean {
  return Boolean(pkg.name && pkg.version && !pkg.private);
}

function matchesPackageFilters(name: string, include: string[], exclude: string[]): boolean {
  const included = include.length === 0 || include.some((pattern) => matchesPattern(name, pattern));
  const excluded = exclude.some((pattern) => matchesPattern(name, pattern));
  return included && !excluded;
}

function matchesPattern(value: string, pattern: string): boolean {
  if (pattern === "*") {
    return true;
  }

  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`).test(value);
}

async function packageFiles(packageDir: string, config: PreparePublishConfig): Promise<string[]> {
  const arborist = new Arborist({ path: packageDir });
  const tree = await arborist.loadActual();
  const files = await packlist(tree);
  const sorted = files.sort();

  if (config.target !== "jsr") {
    return sorted;
  }

  const include = await readJsrPublishInclude(packageDir);

  if (!include) {
    return sorted;
  }

  const matched = sorted.filter((file) => include.some((pattern) => minimatch(file, pattern, {
    dot: true,
  })));

  if (await exists(path.join(packageDir, "jsr.json")) && !matched.includes("jsr.json")) {
    matched.push("jsr.json");
  }

  return matched.sort();
}

async function runBeforeCommands(pkg: WorkspacePackage, config: PreparePublishConfig): Promise<void> {
  for (const command of config.commands.before) {
    console.log(`Running before command for ${pkg.name}: ${command}`);
    await runCommand(command, pkg.dir);
  }
}

function runCommand(command: string, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed with exit code ${code ?? 1}: ${command}`));
    });
  });
}

async function readJsrPublishInclude(packageDir: string): Promise<string[] | undefined> {
  const jsrPath = path.join(packageDir, "jsr.json");

  if (!await exists(jsrPath)) {
    return undefined;
  }

  const json = await readJson(jsrPath);
  const publish = json.publish;

  if (!isRecord(publish) || !Array.isArray(publish.include)) {
    return undefined;
  }

  return publish.include.filter((item): item is string => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
