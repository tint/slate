# @slate/cli

Slate command-line interface.

## Responsibility

- Provide the `slate` binary.
- Implement project commands such as `slate init`, `slate build`, and `slate check`.
- Load project config.
- Coordinate `@slate/compiler`, `@slate/kit`, and `@slate/check`.

## Status

Implemented with `init`, `dev`, `build`, `preview`, and `check` command entry points.

## Install

Using JSR:

```sh
npx jsr add -D @slate/cli
npx jsr add @slate/kit
```

The published CLI package provides the `slate` binary from TypeScript source and requires a modern Node.js runtime.

## Commands

```sh
slate init <directory> [--force]
slate dev [input.slate] [--port 5173] [--host 127.0.0.1] [--publicDir public] [--reload] [--no-reload] [--kit @slate/kit]
slate build [input.slate] [--output dist/index.html] [--tmpDir node_modules/.slate-tmp] [--publicDir public] [--kit @slate/kit]
slate preview [--dir dist] [--port 4173] [--host 127.0.0.1]
slate check <input.slate>
```

`slate init` scaffolds a minimal Slate project with `slate.config.ts`, `src/App.slate`, a sample component, public assets, and package scripts.

`--out` remains accepted as a compatibility alias for `--output`.

`slate dev` is powered by `@slate/vite`. It serves `/` by rendering the configured Slate input through Vite middleware.

By default, `slate dev` injects Vite's browser client. `.slate` changes currently trigger a full page reload through Vite.

`slate preview` is powered by `@slate/vite`. It serves built files only and does not compile, watch, or inject the reload client.

## Programmatic API

```ts
import { defineConfig, runBuild, runCheck, runDev, runInit, runPreview } from "@slate/cli";

await runInit("my-app");
await runCheck({ config: "slate.config.ts" });
await runBuild({ config: "slate.config.ts" });
```

## Configuration

The CLI loads `slate.config.ts`, `slate.config.mjs`, or `slate.config.js` from the current working directory. Use `--config` to choose a specific file.

```ts
import { defineConfig } from "@slate/cli";

export default defineConfig({
  input: "src/App.slate",
  plugins: [],
  vite: {
    define: {},
    resolve: {},
  },
  publicDir: "public",
  dev: {
    host: "127.0.0.1",
    port: 5173,
    reload: true,
  },
  build: {
    output: "dist/index.html",
    tmpDir: "node_modules/.slate-tmp",
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  kit: {
    specifier: "@slate/kit",
  },
});
```

Config files can also export a promise or a function:

```ts
import { defineConfig } from "@slate/cli";

export default defineConfig(({ command, mode, phase }) => ({
  input: "src/App.slate",
  build: {
    output: phase === "build" ? "dist/index.html" : undefined,
  },
  vite: {
    define: {
      __DEV__: JSON.stringify(command === "serve" && mode === "development"),
    },
  },
}));
```

`command` and `mode` follow Vite's config context model. `phase` keeps the exact Slate CLI phase:

```txt
slate dev     -> { command: "serve", mode: "development", phase: "dev" }
slate build   -> { command: "build", mode: "production", phase: "build" }
slate preview -> { command: "serve", mode: "production", phase: "preview" }
slate check   -> { command: "serve", mode: "development", phase: "check" }
```

Files in `publicDir` are served by `slate dev` from `/` and copied by `slate build` into the build output directory. Missing public directories are ignored.

Slate config is the CLI configuration entry. `slate dev` and `slate build` do not load `vite.config.ts` directly. Use top-level `plugins` for Vite-compatible Slate plugins and `vite` for non-plugin Vite options.

For multiple inputs:

```ts
export default defineConfig({
  input: {
    index: "src/pages/Home.slate",
    about: "src/pages/About.slate",
  },
  build: {
    output: "dist",
  },
});
```

Multi-input build treats `build.output` as a directory and writes one HTML file per input name. Multi-input dev maps `/` to the first input and `/<name>` to each named input.

Resolution priority:

```txt
CLI flags > slate.config.* > defaults
```

Relative paths in config are resolved from the config file directory. `.ts` config files are loaded through `tsx` in the published Node CLI, while Bun can import them natively during workspace development.

## Diagnostics

`slate check` prints compiler/check diagnostics with source snippets when source text is available:

```txt
entry.slate:2:3: error: Only TypeScript type exports are allowed in <script slate>.
    export const invalid = true;
    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
```

`slate build` catches Slate runtime render errors and formats them the same way:

```txt
entry.slate:5:5: error: null is not an object (evaluating 'user.name')
  <p>{user.name}</p>
      ^^^^^^^^^
```

## Boundary

The CLI should stay thin. Core behavior should live in reusable packages.

## Publishing note

`@slate/cli` publishes TypeScript source to JSR like the other runtime packages. The `slate` binary points at `src/index.ts`, so the package requires a Node.js version that can execute TypeScript files.

Before publishing a new CLI version:

```sh
npx jsr publish --dry-run
```
