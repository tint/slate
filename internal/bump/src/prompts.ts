import { Logger } from "logtra";
import { createPico } from "logtra/picocolors";
import prompts from "prompts";
import semver from "semver";
import { assertPackageReadyForBump, collectPackageChangelog, type BumpPlan, type PackageInfo } from "./workspace";

const logger = new Logger({
  colorizer: createPico(true),
});

export async function collectBumpPlan(root: string, packages: PackageInfo[]): Promise<BumpPlan | undefined> {
  const pkg = await selectPackage(packages);
  if (!pkg) {
    return undefined;
  }

  await assertPackageReadyForBump(root, pkg);

  const changelog = await collectPackageChangelog(root, pkg);
  printPackageChangelog(pkg, changelog);

  const version = await selectNextVersion(pkg);
  if (!version) {
    return undefined;
  }

  return {
    pkg,
    nextVersion: version,
    changelog: changelog.length ? changelog : ["No package-specific commits found."],
  };
}

export function printPlan(plan: BumpPlan): void {
  logger.log("");
  logger.log("<bold>Bump plan</bold>");
  logger.log(`- <cyan>${plan.pkg.name}</cyan>: ${plan.pkg.version} -> <green>${plan.nextVersion}</green>`);

  for (const entry of plan.changelog) {
    logger.log(`  - ${entry}`);
  }

  logger.log("");
}

export async function confirmPlan(): Promise<boolean> {
  const confirmation = await prompts({
    type: "confirm",
    name: "ok",
    message: "Apply this bump plan?",
    initial: false,
  });

  return Boolean(confirmation.ok);
}

export async function confirmContinue(): Promise<boolean> {
  const confirmation = await prompts({
    type: "confirm",
    name: "ok",
    message: "Bump another package?",
    initial: true,
  });

  return Boolean(confirmation.ok);
}

export function logInfo(message: string): void {
  logger.info(message);
}

export function logWarn(message: string): void {
  logger.warn(message);
}

export function logError(message: string): void {
  logger.error(message);
}

async function selectPackage(packages: PackageInfo[]): Promise<PackageInfo | undefined> {
  const response = await prompts({
    type: "select",
    name: "pkg",
    message: "Select a package to bump",
    choices: packages.map((pkg) => ({
      title: `${pkg.name}@${pkg.version}`,
      description: pkg.relativePath,
      value: pkg.name,
    })),
  });

  return packages.find((pkg) => pkg.name === response.pkg);
}

async function selectNextVersion(pkg: PackageInfo): Promise<string | undefined> {
  const base = await selectBaseVersion(pkg);
  if (!base) {
    return undefined;
  }

  const channel = await selectChannel(pkg);

  if (!channel) {
    return undefined;
  }

  if (channel === "custom") {
    return readCustomVersion(pkg.name);
  }

  return resolveChannelVersion(pkg.version, base, channel);
}

async function selectBaseVersion(pkg: PackageInfo): Promise<string | undefined> {
  const response = await prompts({
    type: "select",
    name: "base",
    message: `Base version for ${pkg.name}@${pkg.version}`,
    choices: [
      { title: "current", description: resolveBaseVersion(pkg.version, "current") ?? "invalid current version", value: "current" },
      { title: "patch", description: resolveBaseVersion(pkg.version, "patch") ?? "invalid current version", value: "patch" },
      { title: "minor", description: resolveBaseVersion(pkg.version, "minor") ?? "invalid current version", value: "minor" },
      { title: "major", description: resolveBaseVersion(pkg.version, "major") ?? "invalid current version", value: "major" },
      { title: "skip", description: "Do not change this package", value: undefined },
    ],
  });

  if (!response.base) {
    return undefined;
  }

  const base = resolveBaseVersion(pkg.version, response.base);
  if (!base) {
    throw new Error(`Cannot resolve base version for ${pkg.name} from invalid version ${pkg.version}.`);
  }

  return base;
}

async function selectChannel(pkg: PackageInfo): Promise<"stable" | "alpha" | "beta" | "rc" | "custom" | undefined> {
  const response = await prompts({
    type: "select",
    name: "channel",
    message: `Release channel for ${pkg.name}@${pkg.version}`,
    choices: [
      { title: "stable", description: "Regular semver release", value: "stable" },
      { title: "alpha", description: "Early prerelease", value: "alpha" },
      { title: "beta", description: "Feature-complete prerelease", value: "beta" },
      { title: "rc", description: "Release candidate", value: "rc" },
      { title: "custom", description: "Enter an exact semver version", value: "custom" },
      { title: "skip", description: "Do not change this package", value: undefined },
    ],
  });

  return response.channel;
}

async function readCustomVersion(name: string): Promise<string> {
  const response = await prompts({
    type: "text",
    name: "version",
    message: `Next version for ${name}`,
    validate: (value) => (semver.valid(value) ? true : "Enter a valid semver version."),
  });

  return response.version;
}

function resolveBaseVersion(version: string, bump: "current" | "patch" | "minor" | "major"): string | undefined {
  const parsed = semver.parse(version);
  if (!parsed) {
    return undefined;
  }

  if (bump === "current") {
    return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  }

  return semver.inc(`${parsed.major}.${parsed.minor}.${parsed.patch}`, bump) ?? undefined;
}

function resolveChannelVersion(current: string, base: string, channel: "stable" | "alpha" | "beta" | "rc"): string {
  if (channel === "stable") {
    return base;
  }

  const parsed = semver.parse(current);
  const baseOfCurrent = parsed ? `${parsed.major}.${parsed.minor}.${parsed.patch}` : "";
  const currentChannel = parsed?.prerelease[0];
  const currentNumber = parsed?.prerelease[1];
  const nextNumber =
    baseOfCurrent === base && currentChannel === channel && typeof currentNumber === "number"
      ? currentNumber + 1
      : 1;

  return `${base}-${channel}.${nextNumber}`;
}

function printPackageChangelog(pkg: PackageInfo, changelog: string[]): void {
  logger.log("");
  logger.log(`<bold>Git changelog for ${pkg.name}</bold>`);

  if (!changelog.length) {
    logger.log("- No package-specific commits found.");
    logger.log("");
    return;
  }

  for (const entry of changelog) {
    logger.log(`- ${entry}`);
  }

  logger.log("");
}
