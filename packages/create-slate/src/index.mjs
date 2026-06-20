#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { constants } from "node:fs";
import { access, mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  if (args.includes("--version") || args.includes("-v")) {
    const packageJson = await readOwnPackageJson();
    console.log(packageJson.version ?? "0.0.0");
    return;
  }

  const force = args.includes("--force");
  const install = args.includes("--install");
  const skipInstall = args.includes("--no-install");
  const directory = args.find((arg) => !arg.startsWith("-"));

  if (!directory) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const packageManager = await detectPackageManager(resolve(directory));

  await createProject(directory, {
    force,
    packageManager,
  });

  console.log(`Created Slate project at ${resolve(directory)}`);
  console.log("");

  const shouldInstall = install || (!skipInstall && await confirmInstall(packageManager));

  if (shouldInstall) {
    await runInstall(resolve(directory), packageManager);
  }

  printNextSteps(directory, packageManager, shouldInstall);
}

function printHelp() {
  console.log(`create-slate

Usage:
  create-slate <directory> [--force] [--install] [--no-install]

Options:
  --force       Overwrite scaffold files in a non-empty directory
  --install     Install dependencies after creating the project
  --no-install  Skip the install prompt
  -h, --help    Show help
  -v, --version
`);
}

async function createProject(targetArg, options) {
  const targetDir = resolve(targetArg);
  assertSafeTargetDir(targetDir);

  await mkdir(targetDir, {
    recursive: true,
  });

  const entries = await readdir(targetDir);

  if (entries.length > 0 && !options.force) {
    throw new Error(`Target directory is not empty: ${targetDir}. Use --force to overwrite scaffold files.`);
  }

  const packageJson = await readOwnPackageJson();
  const projectName = normalizePackageName(basename(targetDir) || "slate-app");

  if (options.force) {
    await backupPackageJson(targetDir);
  }

  await writeFile(`${targetDir}/package.json`, `${JSON.stringify(createPackageJson(projectName, packageJson), null, 2)}\n`, "utf8");
  await writeFile(`${targetDir}/deno.json`, `${JSON.stringify(createDenoJson(), null, 2)}\n`, "utf8");
  await writeFile(`${targetDir}/.npmrc`, "@jsr:registry=https://npm.jsr.io\n", "utf8");
  await writeFile(`${targetDir}/README.md`, createReadme(projectName, options.packageManager), "utf8");
  await writeFile(`${targetDir}/slate.config.ts`, createSlateConfig(), "utf8");
  await writeFile(`${targetDir}/.gitignore`, "node_modules\ndist\n.slate-tmp\n.slate-dev\n", "utf8");
  await mkdir(`${targetDir}/scripts`, { recursive: true });
  await mkdir(`${targetDir}/src/components`, { recursive: true });
  await mkdir(`${targetDir}/public`, { recursive: true });
  await writeFile(`${targetDir}/scripts/slate.mjs`, createSlateBridge(), "utf8");
  await writeFile(`${targetDir}/src/App.slate`, createAppSlate(), "utf8");
  await writeFile(`${targetDir}/src/components/Card.slate`, createCardSlate(), "utf8");
  await writeFile(`${targetDir}/public/favicon.svg`, createFavicon(), "utf8");
}

async function readOwnPackageJson() {
  return JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
}

function createPackageJson(projectName, packageJson) {
  const cliRange = toJsrAliasRange("cli", packageJson.devDependencies?.["@slate/cli"]);
  const kitRange = toJsrAliasRange("kit", packageJson.devDependencies?.["@slate/kit"]);

  return {
    name: projectName,
    private: true,
    type: "module",
    scripts: {
      dev: "node scripts/slate.mjs dev",
      check: "node scripts/slate.mjs check",
      build: "node scripts/slate.mjs build",
      preview: "node scripts/slate.mjs preview",
    },
    dependencies: {
      "@slate/kit": kitRange,
    },
    devDependencies: {
      "@slate/cli": cliRange,
    },
  };
}

function createDenoJson() {
  return {
    tasks: {
      dev: "node scripts/slate.mjs dev",
      check: "node scripts/slate.mjs check",
      build: "node scripts/slate.mjs build",
      preview: "node scripts/slate.mjs preview",
    },
  };
}

function toJsrAliasRange(packageName, range) {
  return `npm:@jsr/slate__${packageName}@${range ?? "latest"}`;
}

function createReadme(projectName, packageManager) {
  const commands = packageManagerCommands(packageManager);

  return `# ${projectName}

Minimal Slate project.

## Install

\`\`\`sh
${commands.install}
\`\`\`

## Commands

\`\`\`sh
${commands.run} dev
${commands.run} check
${commands.run} build
${commands.run} preview
\`\`\`
`;
}

function createSlateConfig() {
  return `import { defineConfig } from "@slate/cli";

export default defineConfig({
  input: "src/App.slate",
  publicDir: "public",
  dev: {
    host: "127.0.0.1",
    port: 5173,
    reload: true,
  },
  build: {
    output: "dist/index.html",
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});
`;
}

function createSlateBridge() {
  return `import { run } from "@slate/cli";

await run(process.argv.slice(2));
`;
}

function createFavicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#111111" />
  <path d="M9 9h14v4H13v4h8v4H9z" fill="#ffffff" />
</svg>
`;
}

function createAppSlate() {
  return `<script slate>
import Card from "./components/Card.slate";

const title = "Slate";
const items = ["syntax", "diagnostics", "components"];
</script>

<main>
  <h1>{title}</h1>

  <Card title="Ready">
    <ul>
      {#each items as item}
        <li>{item}</li>
      {/each}
    </ul>
  </Card>
</main>
`;
}

function createCardSlate() {
  return `<script slate>
const title = $prop("title", "Card");
</script>

<section class="card">
  <h2>{title}</h2>
  <slot />
</section>
`;
}

function normalizePackageName(value) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "slate-app";
}

function assertSafeTargetDir(targetDir) {
  const parsed = parse(targetDir);
  const forbidden = new Set([
    parsed.root,
    resolve(homedir()),
  ]);

  if (forbidden.has(targetDir)) {
    throw new Error(`Refusing to scaffold into unsafe target directory: ${targetDir}`);
  }
}

async function backupPackageJson(targetDir) {
  const source = resolve(targetDir, "package.json");

  if (!await exists(source)) {
    return;
  }

  let target = resolve(targetDir, "package.json.old");
  let index = 1;

  while (await exists(target)) {
    index += 1;
    target = resolve(targetDir, `package.json.old.${index}`);
  }

  await rename(source, target);
  console.log(`Moved existing package.json to ${basename(target)}`);
}

async function detectPackageManager(targetDir) {
  if (await exists(resolve(targetDir, "deno.json")) || await exists(resolve(targetDir, "deno.jsonc")) || await exists(resolve(targetDir, "deno.lock"))) {
    return "deno";
  }

  if (await exists(resolve(targetDir, "bun.lock")) || await exists(resolve(targetDir, "bun.lockb"))) {
    return "bun";
  }

  if (await exists(resolve(targetDir, "pnpm-lock.yaml"))) {
    return "pnpm";
  }

  if (await exists(resolve(targetDir, "yarn.lock"))) {
    return "yarn";
  }

  if (await exists(resolve(targetDir, "package-lock.json"))) {
    return "npm";
  }

  const userAgent = process.env.npm_config_user_agent ?? "";

  if (userAgent.startsWith("deno/")) {
    return "deno";
  }

  if (userAgent.startsWith("bun/")) {
    return "bun";
  }

  if (userAgent.startsWith("pnpm/")) {
    return "pnpm";
  }

  if (userAgent.startsWith("yarn/")) {
    return "yarn";
  }

  if (userAgent.startsWith("npm/")) {
    return "npm";
  }

  return "npm";
}

async function confirmInstall(packageManager) {
  if (!input.isTTY || !output.isTTY) {
    return false;
  }

  const rl = createInterface({
    input,
    output,
  });

  try {
    const answer = await rl.question(`Install dependencies with ${packageManager}? [Y/n] `);
    return !/^n(o)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function runInstall(targetDir, packageManager) {
  const commands = packageManagerCommands(packageManager);
  console.log("");
  console.log(`Installing dependencies with ${packageManager}...`);
  await spawnCommand(commands.installCommand, commands.installArgs, targetDir);
}

function printNextSteps(directory, packageManager, installed) {
  const commands = packageManagerCommands(packageManager);

  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${directory}`);

  if (!installed) {
    console.log(`  ${commands.install}`);
  }

  console.log(`  ${commands.run} dev`);
  console.log(`  ${commands.run} check`);
  console.log(`  ${commands.run} build`);
  console.log(`  ${commands.run} preview`);
}

function packageManagerCommands(packageManager) {
  switch (packageManager) {
    case "deno":
      return {
        install: "deno install",
        installCommand: "deno",
        installArgs: ["install"],
        run: "deno task",
      };
    case "bun":
      return {
        install: "bun install",
        installCommand: "bun",
        installArgs: ["install"],
        run: "bun run",
      };
    case "pnpm":
      return {
        install: "pnpm install",
        installCommand: "pnpm",
        installArgs: ["install"],
        run: "pnpm",
      };
    case "yarn":
      return {
        install: "yarn install",
        installCommand: "yarn",
        installArgs: ["install"],
        run: "yarn",
      };
    default:
      return {
        install: "npm install",
        installCommand: "npm",
        installArgs: ["install"],
        run: "npm run",
      };
  }
}

function spawnCommand(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}.`));
    });
  });
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
