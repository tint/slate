import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);
const packageRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const workspaceRoot = resolve(packageRoot, "../../..");
const stageRoot = join(packageRoot, ".tmp-vsix");
const args = process.argv.slice(2);

await rm(stageRoot, {
  recursive: true,
  force: true,
});
await mkdir(stageRoot, {
  recursive: true,
});

await copyPackageFile("README.md");
await copyPackageFile("language-configuration.json");
await cp(join(workspaceRoot, "LICENSE"), join(stageRoot, "LICENSE"), {
  dereference: true,
});
await cp(join(packageRoot, "syntaxes"), join(stageRoot, "syntaxes"), {
  recursive: true,
});
await cp(join(packageRoot, "dist"), join(stageRoot, "dist"), {
  recursive: true,
});

const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
delete packageJson.private;
delete packageJson.scripts;
delete packageJson.devDependencies;
packageJson.dependencies = {
  typescript: packageJson.dependencies.typescript,
};
await writeFile(join(stageRoot, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);

const typeScriptPackageRoot = dirname(require.resolve("typescript/package.json"));
await cp(typeScriptPackageRoot, join(stageRoot, "node_modules", "typescript"), {
  recursive: true,
  dereference: true,
});

await writeFile(
  join(stageRoot, ".vscodeignore"),
  [
    ".vscode/**",
    "src/**",
    "scripts/**",
    "tsconfig.json",
    "*.vsix",
    "*.log",
    ".DS_Store",
    "",
  ].join("\n"),
);

await run("vsce", [
  "publish",
  "--allow-missing-repository",
  ...args,
], stageRoot);

async function copyPackageFile(name) {
  await cp(join(packageRoot, name), join(stageRoot, name), {
    dereference: true,
  });
}

async function run(command, args, cwd) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new Error(`${command} exited with code ${code}`));
    });
  });
}
