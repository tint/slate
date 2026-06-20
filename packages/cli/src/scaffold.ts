import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

export type InitOptions = {
  force?: boolean;
};

/** Scaffold a minimal Slate project. */
export async function runInit(targetArg: string, options: InitOptions = {}): Promise<void> {
  const targetDir = resolve(targetArg);
  await createProject(targetDir, {
    force: options.force ?? false,
  });
}

// The scaffold templates live in the CLI so `slate init` is the single source
// of truth. External create-* wrappers should delegate here instead of copying
// these files.
type CreateProjectOptions = {
  force: boolean;
};

async function createProject(targetDir: string, options: CreateProjectOptions): Promise<void> {
  await mkdir(targetDir, {
    recursive: true,
  });

  const entries = await readdir(targetDir);

  if (entries.length > 0) {
    if (!options.force) {
      throw new Error(`Target directory is not empty: ${targetDir}. Use --force to overwrite scaffold files.`);
    }

    await rm(targetDir, {
      recursive: true,
      force: true,
    });
    await mkdir(targetDir, {
      recursive: true,
    });
  }

  const projectName = normalizePackageName(basename(targetDir) || "slate-app");

  await writeFile(`${targetDir}/package.json`, `${JSON.stringify(createPackageJson(projectName), null, 2)}\n`, "utf8");
  await writeFile(`${targetDir}/README.md`, createReadme(projectName), "utf8");
  await writeFile(`${targetDir}/slate.config.ts`, createSlateConfig(), "utf8");
  await writeFile(`${targetDir}/.gitignore`, "node_modules\ndist\n.slate-tmp\n.slate-dev\n", "utf8");
  await mkdir(`${targetDir}/src`, {
    recursive: true,
  });
  await mkdir(`${targetDir}/src/components`, {
    recursive: true,
  });
  await mkdir(`${targetDir}/public`, {
    recursive: true,
  });
  await writeFile(`${targetDir}/src/App.slate`, createAppSlate(), "utf8");
  await writeFile(`${targetDir}/src/components/Card.slate`, createCardSlate(), "utf8");
  await writeFile(`${targetDir}/public/favicon.svg`, createFavicon(), "utf8");
}

function createPackageJson(projectName: string): Record<string, unknown> {
  return {
    name: projectName,
    private: true,
    type: "module",
    scripts: {
      dev: "slate dev",
      check: "slate check",
      build: "slate build",
      preview: "slate preview",
    },
    dependencies: {
      "@slate/kit": "latest",
    },
    devDependencies: {
      "@slate/cli": "latest",
    },
  };
}

function createReadme(projectName: string): string {
  return `# ${projectName}

Minimal Slate project.

## Commands

\`\`\`sh
bun install
bun run dev
bun run check
bun run build
bun run preview
\`\`\`
`;
}

function createSlateConfig(): string {
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

function createFavicon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#111111" />
  <path d="M9 9h14v4H13v4h8v4H9z" fill="#ffffff" />
</svg>
`;
}

function createAppSlate(): string {
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

function createCardSlate(): string {
  return `<script slate>
const title = $prop("title", "Card");
</script>

<section class="card">
  <h2>{title}</h2>
  <slot />
</section>
`;
}

function normalizePackageName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "slate-app";
}
