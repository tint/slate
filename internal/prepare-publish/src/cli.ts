import { Logger } from "logtra";
import { createPico } from "logtra/picocolors";
import path from "node:path";
import { findCurrentPackageContext } from "./current-package";
import { createPreparePlans } from "./package-plan";
import { stagePlans } from "./stage";
import type { PreparePlan, PreparePublishOptions, PublishTarget } from "./types";
import { findWorkspaceContext } from "./workspace";

const logger = new Logger({
  colorizer: createPico(true),
});

export async function run(argv = process.argv.slice(2), commandCwd = resolveCommandCwd()): Promise<void> {
  const options = parseArgs(argv);

  if (options.help) {
    printHelp();
    return;
  }

  const workspace = await findWorkspaceContext(commandCwd);
  const current = await findCurrentPackageContext(commandCwd, workspace);
  const plans = await createPreparePlans({
    commandCwd,
    current,
    options,
  });
  const errors = plans.flatMap((plan) => plan.errors);

  printPlans(plans, {
    mode: options.all || options.targets.length > 0 ? "workspace" : "current-package",
    root: options.all || options.targets.length > 0 ? workspace?.root ?? commandCwd : current.pkg.dir,
    workspaceSource: workspace?.source,
    packageManager: workspace?.packageManager ?? current.packageManager,
    dryRun: options.dryRun,
  });

  if (errors.length > 0) {
    printErrors(errors);
    process.exitCode = 1;
    return;
  }

  const outDir = path.resolve(commandCwd, plans[0]?.config.out ?? options.out ?? ".prepare-publish");
  await stagePlans(plans, {
    clean: options.clean,
    dryRun: options.dryRun,
    outDir,
  });

  if (!options.dryRun) {
    logger.info(`Prepared ${plans.length} package${plans.length === 1 ? "" : "s"}.`);
  }
}

type ParsedOptions = PreparePublishOptions & {
  help: boolean;
};

function parseArgs(argv: string[]): ParsedOptions {
  const options: ParsedOptions = {
    targets: [],
    all: false,
    dryRun: false,
    clean: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--all") {
      options.all = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--clean") {
      options.clean = true;
      continue;
    }

    if (arg === "--out") {
      options.out = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--out=")) {
      options.out = arg.slice("--out=".length);
      continue;
    }

    if (arg === "--target") {
      options.target = parseTarget(readOptionValue(argv, index, arg));
      index += 1;
      continue;
    }

    if (arg.startsWith("--target=")) {
      options.target = parseTarget(arg.slice("--target=".length));
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    options.targets.push(arg);
  }

  if (options.all && options.targets.length > 0) {
    throw new Error("Cannot combine --all with explicit package targets.");
  }

  return options;
}

function readOptionValue(argv: string[], index: number, option: string): string {
  const value = argv[index + 1];

  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${option}.`);
  }

  return value;
}

function parseTarget(value: string): PublishTarget {
  if (value === "jsr" || value === "npm") {
    return value;
  }

  throw new Error(`Invalid target: ${value}. Expected "jsr" or "npm".`);
}

function resolveCommandCwd(): string {
  return path.resolve(process.env.PREPARE_PUBLISH_CWD ?? process.env.INIT_CWD ?? process.cwd());
}

function printPlans(
  plans: PreparePlan[],
  context: {
    mode: "current-package" | "workspace";
    root: string;
    workspaceSource: string | undefined;
    packageManager: string;
    dryRun: boolean;
  },
): void {
  logger.log("Prepare publish plan");
  logger.log("");
  logger.log(`mode: ${context.mode}`);
  logger.log(`root: ${context.root}`);
  if (context.workspaceSource) {
    logger.log(`workspace: ${context.workspaceSource}`);
  }
  logger.log(`package manager: ${context.packageManager}`);
  logger.log(`dry run: ${context.dryRun ? "true" : "false"}`);
  logger.log("");

  if (plans.length === 0) {
    logger.warn("No packages selected.");
    return;
  }

  for (const plan of plans) {
    logger.log(`${plan.pkg.name} ${plan.pkg.version || "<no version>"}`);
    logger.log(`  source: ${plan.pkg.relativeDir}`);
    logger.log(`  target: ${path.relative(context.root, plan.stagingDir) || "."}`);
    logger.log(`  files: ${plan.files.length}`);

    if (plan.rewrites.length === 0) {
      logger.log("  rewrite: none");
    } else {
      logger.log("  rewrite:");
      for (const rewrite of plan.rewrites) {
        logger.log(`    ${rewrite.field}.${rewrite.name}: ${rewrite.from} -> ${rewrite.to}`);
      }
    }

    logger.log("");
  }
}

function printErrors(errors: PreparePlan["errors"]): void {
  logger.error("Prepare publish failed:");
  for (const error of errors) {
    logger.error(`- ${error.message}`);
  }
}

function printHelp(): void {
  console.log(`prepare-publish

Usage:
  prepare-publish
  prepare-publish <package-name>
  prepare-publish --all

Options:
  --all             Prepare all publishable workspace packages
  --dry-run         Print the plan without writing staging files
  --clean           Remove the staging root before writing
  --out <dir>       Override the staging output directory
  --target <name>   Override target: jsr or npm
  -h, --help        Show help
`);
}
