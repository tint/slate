import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";
import { run } from "../src/cli";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
  process.exitCode = undefined;
});

test("stages the current package and removes source-only metadata", async () => {
  const root = await createTempDir();
  await writeJson(path.join(root, "package.json"), {
    name: "single-package",
    version: "1.2.3",
    type: "module",
    private: false,
    scripts: {
      test: "echo test",
    },
    devDependencies: {
      typescript: "^6.0.3",
    },
    preparePublishConfig: {
      metadata: {
        remove: ["private", "scripts", "devDependencies", "preparePublishConfig"],
      },
    },
  });
  await writeFile(path.join(root, "index.js"), "export const value = 1;\n");

  await run(["--clean"], root);

  const staged = await readJson(path.join(root, ".prepare-publish", "single-package", "package.json"));
  expect(staged.name).toBe("single-package");
  expect(staged.version).toBe("1.2.3");
  expect(staged).not.toHaveProperty("private");
  expect(staged).not.toHaveProperty("scripts");
  expect(staged).not.toHaveProperty("devDependencies");
  expect(staged).not.toHaveProperty("preparePublishConfig");
});

test("rewrites workspace and catalog protocols before writing package metadata", async () => {
  const root = await createTempDir();
  await writeJson(path.join(root, "package.json"), {
    name: "root-package",
    version: "1.0.0",
    private: true,
    workspaces: ["packages/*"],
    catalog: {
      typescript: "^6.0.3",
    },
  });
  await mkdir(path.join(root, "packages", "a"), { recursive: true });
  await mkdir(path.join(root, "packages", "b"), { recursive: true });
  await writeJson(path.join(root, "packages", "a", "package.json"), {
    name: "pkg-a",
    version: "1.0.0",
    dependencies: {
      "pkg-b": "workspace:^",
    },
    devDependencies: {
      typescript: "catalog:",
    },
  });
  await writeJson(path.join(root, "packages", "b", "package.json"), {
    name: "pkg-b",
    version: "2.0.0",
  });
  await writeFile(path.join(root, "packages", "a", "index.js"), "export {};\n");
  await writeFile(path.join(root, "packages", "b", "index.js"), "export {};\n");

  await run(["--clean", "pkg-a"], root);

  const staged = await readJson(path.join(root, ".prepare-publish", "pkg-a", "package.json"));
  expect(staged.dependencies?.["pkg-b"]).toBe("^2.0.0");
  expect(staged).not.toHaveProperty("devDependencies");
});

test("skips publish=false packages when preparing all workspace packages", async () => {
  const root = await createTempDir();
  await writeJson(path.join(root, "package.json"), {
    name: "root-package",
    version: "1.0.0",
    private: true,
    workspaces: ["packages/*"],
  });
  await mkdir(path.join(root, "packages", "a"), { recursive: true });
  await mkdir(path.join(root, "packages", "b"), { recursive: true });
  await writeJson(path.join(root, "packages", "a", "package.json"), {
    name: "pkg-a",
    version: "1.0.0",
  });
  await writeJson(path.join(root, "packages", "b", "package.json"), {
    name: "pkg-b",
    version: "1.0.0",
    preparePublishConfig: {
      publish: false,
    },
  });
  await writeFile(path.join(root, "packages", "a", "index.js"), "export {};\n");
  await writeFile(path.join(root, "packages", "b", "index.js"), "export {};\n");

  await run(["--clean", "--all"], root);

  await expect(fileExists(path.join(root, ".prepare-publish", "pkg-a", "package.json"))).resolves.toBe(true);
  await expect(fileExists(path.join(root, ".prepare-publish", "pkg-b", "package.json"))).resolves.toBe(false);
});

test("root publish=false does not disable workspace child packages", async () => {
  const root = await createTempDir();
  await writeJson(path.join(root, "package.json"), {
    name: "root-package",
    version: "1.0.0",
    private: true,
    workspaces: ["packages/*"],
    preparePublishConfig: {
      publish: false,
      workspace: {
        root: "exclude",
      },
    },
  });
  await mkdir(path.join(root, "packages", "a"), { recursive: true });
  await writeJson(path.join(root, "packages", "a", "package.json"), {
    name: "pkg-a",
    version: "1.0.0",
  });
  await writeFile(path.join(root, "packages", "a", "index.js"), "export {};\n");

  await run(["--clean", "--all"], root);

  await expect(fileExists(path.join(root, ".prepare-publish", "pkg-a", "package.json"))).resolves.toBe(true);
  await expect(fileExists(path.join(root, ".prepare-publish", "root-package", "package.json"))).resolves.toBe(false);
});

test("fails when explicitly preparing a publish=false package", async () => {
  const root = await createTempDir();
  await writeJson(path.join(root, "package.json"), {
    name: "root-package",
    version: "1.0.0",
    private: true,
    workspaces: ["packages/*"],
  });
  await mkdir(path.join(root, "packages", "blocked"), { recursive: true });
  await writeJson(path.join(root, "packages", "blocked", "package.json"), {
    name: "blocked-package",
    version: "1.0.0",
    preparePublishConfig: {
      publish: false,
    },
  });
  await writeFile(path.join(root, "packages", "blocked", "index.js"), "export {};\n");

  await run(["blocked-package"], root);

  expect(process.exitCode).toBe(1);
  await expect(fileExists(path.join(root, ".prepare-publish", "blocked-package", "package.json"))).resolves.toBe(false);
});

test("does not write staging files in dry-run mode", async () => {
  const root = await createTempDir();
  await writeJson(path.join(root, "package.json"), {
    name: "dry-run-package",
    version: "1.0.0",
  });
  await writeFile(path.join(root, "index.js"), "export {};\n");

  await run(["--dry-run"], root);

  await expect(fileExists(path.join(root, ".prepare-publish", "dry-run-package", "package.json"))).resolves.toBe(false);
});

test("fails when workspace.root include selects a private root package", async () => {
  const root = await createTempDir();
  await writeJson(path.join(root, "package.json"), {
    name: "private-root",
    version: "1.0.0",
    private: true,
    workspaces: ["packages/*"],
    preparePublishConfig: {
      workspace: {
        root: "include",
      },
    },
  });

  await run(["--all"], root);

  expect(process.exitCode).toBe(1);
  await expect(fileExists(path.join(root, ".prepare-publish", "private-root", "package.json"))).resolves.toBe(false);
});

test("rewrites dependencies with pnpm workspace catalog and workspace protocols", async () => {
  const root = await createTempDir();
  await writeJson(path.join(root, "package.json"), {
    name: "pnpm-root",
    version: "1.0.0",
    private: true,
  });

  await writeFile(
    path.join(root, "pnpm-workspace.yaml"),
    [
      "packages:",
      "  - packages/*",
      "catalog:",
      "  typescript: ^6.0.3",
    ].join("\n") + "\n",
  );

  await mkdir(path.join(root, "packages", "a"), { recursive: true });
  await mkdir(path.join(root, "packages", "b"), { recursive: true });

  await writeJson(path.join(root, "packages", "a", "package.json"), {
    name: "pkg-a",
    version: "1.0.0",
    dependencies: {
      "pkg-b": "workspace:^",
      "typescript": "catalog:typescript",
    },
  });

  await writeJson(path.join(root, "packages", "b", "package.json"), {
    name: "pkg-b",
    version: "2.0.0",
  });

  await writeFile(path.join(root, "packages", "a", "index.js"), "export {}\n");
  await writeFile(path.join(root, "packages", "b", "index.js"), "export {}\n");

  await run(["--clean", "pkg-a"], root);

  const staged = await readJson(path.join(root, ".prepare-publish", "pkg-a", "package.json"));
  expect(staged.dependencies?.["pkg-b"]).toBe("^2.0.0");
  expect(staged.dependencies?.typescript).toBe("^6.0.3");
});

test("packages are staged with npm-packlist constraints", async () => {
  const root = await createTempDir();
  await writeJson(path.join(root, "package.json"), {
    name: "packlist-package",
    version: "1.0.0",
    files: ["dist"],
    scripts: {
      build: "echo build",
    },
    preparePublishConfig: {
      metadata: {
        remove: ["scripts", "preparePublishConfig"],
      },
    },
  });

  await mkdir(path.join(root, "dist"), { recursive: true });
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "dist", "index.js"), "export const value = 1;\n");
  await writeFile(path.join(root, "src", "hidden.ts"), "export const hidden = 2;\n");
  await writeFile(path.join(root, ".npmignore"), "src\n");

  await run(["--clean"], root);

  await expect(fileExists(path.join(root, ".prepare-publish", "packlist-package", "dist", "index.js"))).resolves.toBe(true);
  await expect(fileExists(path.join(root, ".prepare-publish", "packlist-package", "src", "hidden.ts"))).resolves.toBe(false);
  await expect(fileExists(path.join(root, ".prepare-publish", "packlist-package", "scripts"))).resolves.toBe(false);
});

test("jsr target stages only files matched by jsr publish includes", async () => {
  const root = await createTempDir();
  await writeJson(path.join(root, "package.json"), {
    name: "jsr-package",
    version: "1.0.0",
    type: "module",
  });
  await writeJson(path.join(root, "jsr.json"), {
    name: "@scope/jsr-package",
    version: "1.0.0",
    exports: {
      ".": "./src/index.ts",
    },
    publish: {
      include: [
        "README.md",
        "package.json",
        "src/**/*.ts",
      ],
    },
  });
  await writeFile(path.join(root, "README.md"), "# jsr-package\n");
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "dist"), { recursive: true });
  await mkdir(path.join(root, "fixtures"), { recursive: true });
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await writeFile(path.join(root, "src", "index.ts"), "export const value = 1;\n");
  await writeFile(path.join(root, "dist", "index.mjs"), "export const value = 1;\n");
  await writeFile(path.join(root, "fixtures", "input.ts"), "export const value = 1;\n");
  await writeFile(path.join(root, "scripts", "build.ts"), "export const value = 1;\n");

  await run(["--clean"], root);

  const stagedRoot = path.join(root, ".prepare-publish", "jsr-package");
  await expect(fileExists(path.join(stagedRoot, "README.md"))).resolves.toBe(true);
  await expect(fileExists(path.join(stagedRoot, "jsr.json"))).resolves.toBe(true);
  await expect(fileExists(path.join(stagedRoot, "src", "index.ts"))).resolves.toBe(true);
  await expect(fileExists(path.join(stagedRoot, "dist", "index.mjs"))).resolves.toBe(false);
  await expect(fileExists(path.join(stagedRoot, "fixtures", "input.ts"))).resolves.toBe(false);
  await expect(fileExists(path.join(stagedRoot, "scripts", "build.ts"))).resolves.toBe(false);
});

test("runs a single before command before staging files", async () => {
  const root = await createTempDir();
  await writeJson(path.join(root, "package.json"), {
    name: "command-package",
    version: "1.0.0",
    type: "module",
    preparePublishConfig: {
      commands: {
        before: "node -e \"require('node:fs').writeFileSync('src/generated.ts', 'export const generated = true;\\\\n')\"",
      },
    },
  });
  await writeJson(path.join(root, "jsr.json"), {
    name: "@scope/command-package",
    version: "1.0.0",
    exports: {
      ".": "./src/index.ts",
    },
    publish: {
      include: [
        "package.json",
        "src/**/*.ts",
      ],
    },
  });
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src", "index.ts"), "export {};\n");

  await run(["--clean"], root);

  await expect(fileExists(path.join(root, ".prepare-publish", "command-package", "src", "generated.ts"))).resolves.toBe(true);
});

test("runs before command arrays in order", async () => {
  const root = await createTempDir();
  await writeJson(path.join(root, "package.json"), {
    name: "command-array-package",
    version: "1.0.0",
    type: "module",
    preparePublishConfig: {
      commands: {
        before: [
          "node -e \"require('node:fs').writeFileSync('src/first.ts', 'export const first = true;\\\\n')\"",
          "node -e \"require('node:fs').appendFileSync('src/first.ts', 'export const second = true;\\\\n')\"",
        ],
      },
    },
  });
  await writeJson(path.join(root, "jsr.json"), {
    name: "@scope/command-array-package",
    version: "1.0.0",
    exports: {
      ".": "./src/index.ts",
    },
    publish: {
      include: [
        "package.json",
        "src/**/*.ts",
      ],
    },
  });
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src", "index.ts"), "export {};\n");

  await run(["--clean"], root);

  const generated = await readFile(path.join(root, ".prepare-publish", "command-array-package", "src", "first.ts"), "utf8");
  expect(generated).toContain("first");
  expect(generated).toContain("second");
});

test("does not run before commands during dry-run", async () => {
  const root = await createTempDir();
  await writeJson(path.join(root, "package.json"), {
    name: "dry-run-command-package",
    version: "1.0.0",
    preparePublishConfig: {
      commands: {
        before: "node -e \"require('node:fs').writeFileSync('generated.txt', 'created')\"",
      },
    },
  });

  await run(["--dry-run"], root);

  await expect(fileExists(path.join(root, "generated.txt"))).resolves.toBe(false);
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "prepare-publish-"));
  tempDirs.push(dir);
  return dir;
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJson(file: string): Promise<any> {
  return JSON.parse(await readFile(file, "utf8"));
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
}
