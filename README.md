# Slate

Slate is a compile-time render engine for `.slate` files.

The project is currently a TypeScript workspace using Bun for dependency management only. Runtime packages should remain Node-compatible.

## Current status

Implemented:

- `.slate` parser and compiler.
- `<script slate>` compile-time TypeScript support.
- Runtime kit helpers.
- Vite-powered dev/build/preview integration.
- CLI init/dev/build/preview/check commands.
- Source-mapped CLI diagnostics with source snippets.
- Runtime render errors mapped back to `.slate` expression ranges.
- Static checker.
- TypeScript virtual document support.
- Language server diagnostics, hover, completion, definition, document symbols, and semantic tokens.
- VS Code extension with local Extension Host and VSIX workflows.

## Workspace

```txt
internal/
|- bump

packages/
|- compiler
|- kit
|- vite
|- cli
|- language-tools/
|  |- check
|  |- language-server
|  |- ts-plugin
|  |- vscode
|  |- zed
```

The root `package.json` is also treated as a workspace package for internal version management.

## Development

Install dependencies:

```sh
bun install
```

Check source packages and build editor extension packages:

```sh
bun run build
```

Run all tests:

```sh
bun run test:all
```

Run the internal version bump helper:

```sh
bun run bump
```

Run a local Slate dev server:

```sh
bun packages/cli/src/index.ts dev --port 5173
```

The current dev server is powered by Vite. `.slate` changes trigger a full page reload.

## Version bump workflow

`bun run bump` is an internal helper for updating workspace package versions. It does not publish packages.

It supports:

- the root workspace package
- `packages/*`
- `packages/language-tools/*`
- `internal/*`

Preconditions:

- the workspace root must be the git repository root
- the selected package path must not contain uncommitted changes

Flow:

- select one package
- review package-specific changelog entries collected from git commits
- select the base version: `current`, `patch`, `minor`, or `major`
- select the channel: `stable`, `alpha`, `beta`, `rc`, `custom`, or `skip`
- confirm the plan
- optionally continue with another package

For normal releases, `stable` writes the selected base version. For prereleases, the version uses the selected channel and increments from `.1`, for example `0.2.0-alpha.1`, `0.2.0-beta.1`, or `0.2.0-rc.1`.

Changelog entries are generated from git commit subjects scoped to the selected package path. For the root workspace package, changelog collection excludes `packages/` and `internal/`.

The helper updates:

- package `version`
- matching `jsr.json` `version`
- package `CHANGELOG.md`
- internal `workspace:` dependency ranges

## Getting started

Create a project:

```sh
slate init my-app
cd my-app
bun install
bun run dev
```

Project commands:

```sh
bun run check
bun run build
bun run preview
```

## Configuration

Slate can load `slate.config.ts`, `slate.config.mjs`, or `slate.config.js` from the current working directory:

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
    tmpDir: "node_modules/.slate-dev",
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

Files in `publicDir` are served by `slate dev` from `/` and copied by `slate build` into the build output directory.

`slate dev` injects a small browser reload client by default. Disable it with `dev.reload: false` or `--no-reload`.

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

Multi-input build writes `dist/index.html` and `dist/about.html`. Multi-input dev maps `/` to the first input and `/<name>` to each named input.

CLI flags override config values.

Relative paths in config are resolved from the config file directory. TypeScript config files are supported in the published Node CLI through the bundled `tsx` config loader.

## Programmatic API

```ts
import { defineConfig, runBuild, runCheck, runDev, runInit, runPreview } from "@slate/cli";

await runInit("my-app");
await runCheck({ config: "slate.config.ts" });
await runBuild({ config: "slate.config.ts" });
```

## Alpha limitations

- The compiler/parser is still MVP-level and needs more edge-case coverage.
- Vite plugins are accepted through `plugins`, but full ecosystem compatibility is not guaranteed yet.
- Props and slots type inference is not complete across component boundaries.
- Client runtime features and client asset bundling are not designed yet.
- Public APIs may still change before a stable release.

## JSR publishing strategy

First publish candidates:

```txt
@slate/compiler
@slate/kit
@slate/vite
@slate/check
```

These packages publish TypeScript source directly through `jsr.json`.

`@slate/cli` has a `jsr.json` draft, but it currently publishes built files from `dist`. CLI binary distribution still needs a separate validation pass before treating JSR publishing as stable.

Editor integration packages are not first-wave JSR packages.

## VS Code local DX

Open the extension development workspace:

```sh
bun run vscode:dev
```

Then press `F5` in VS Code.

Build a local VSIX:

```sh
bun run vscode:package
```

Install the generated VSIX:

```sh
code --install-extension packages/language-tools/vscode/slate-vscode.vsix --force
```

## Documentation

- [DESIGN.md](./DESIGN.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
