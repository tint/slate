# @slate/cli

Command-line tools for developing, checking, building, and previewing Slate projects.

Project scaffolding is owned by `create-slate`.

## Requirements

`@slate/cli` is published as TypeScript source and requires a modern Node.js runtime that can execute `.ts` files.

## Initialize a project

There are two ways to start using Slate:

- Use `create-slate` for a new project.
- Add `@slate/cli` manually to an existing project.

### Using `create-slate`

For a new project, prefer `create-slate`:

```sh
npm create slate@latest my-app
cd my-app
npm install
npm run dev
```

The generated project includes:

- `package.json`
- `deno.json`
- `slate.config.ts`
- `src/App.slate`
- `src/components/Card.slate`
- `scripts/slate.mjs`
- package scripts for dev, check, build, and preview

### Manual setup

Install the CLI and runtime package:

Using JSR:

```sh
npx jsr add -D @slate/cli
npx jsr add @slate/kit
```

Create `slate.config.ts`:

```ts
import { defineConfig } from "@slate/cli";

export default defineConfig({
  input: "src/App.slate",
  plugins: [],
  publicDir: "public",
  build: {
    output: "dist/index.html",
  },
});
```

Create `src/App.slate`:

```slate
<script slate>
const title = "Slate";
</script>

<main>
  <h1>{title}</h1>
</main>
```

Because JSR's npm compatibility layer does not currently expose package `bin` entries, use a small local bridge script.

Create `scripts/slate.mjs`:

```js
import { run } from "@slate/cli";

await run(process.argv.slice(2));
```

Then add scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "node scripts/slate.mjs dev",
    "check": "node scripts/slate.mjs check",
    "build": "node scripts/slate.mjs build",
    "preview": "node scripts/slate.mjs preview"
  }
}
```

Now run:

```sh
npm run dev
```

`plugins` accepts Vite-compatible plugins that should participate in Slate dev/build orchestration. Put project plugins here instead of relying on a separate `vite.config.ts`.

## Commands

Inside a generated or manually configured project, the local bridge forwards to these CLI commands:

```sh
slate dev
slate check
slate build
slate preview
```

### `slate dev`

Starts the development server.

```sh
slate dev
slate dev src/App.slate --port 5173 --host 127.0.0.1 --preserveScroll
```

By default, `.slate` changes trigger a full page reload through Vite.

### `slate check`

Checks Slate files and prints diagnostics.

```sh
slate check
slate check src/App.slate
```

### `slate build`

Builds Slate input files to static HTML.

```sh
slate build
slate build src/App.slate --output dist/index.html
```

`--out` is also accepted as an alias for `--output`.

### `slate preview`

Serves the built output directory.

```sh
slate preview
slate preview --dir dist --port 4173
```

Preview serves existing files only. It does not compile, watch, or inject the development reload client.

## Configuration

The CLI loads `slate.config.ts`, `slate.config.mjs`, or `slate.config.js` from the current working directory.

Use `--config` to choose a specific config file:

```sh
slate dev --config ./slate.config.ts
```

Basic config:

```ts
import { defineConfig } from "@slate/cli";

export default defineConfig({
  input: "src/App.slate",
  plugins: [],
  publicDir: "public",
  html: {
    format: "preserve",
    attributeDiagnostics: [],
  },
  dev: {
    host: "127.0.0.1",
    port: 5173,
    reload: true,
    preserveScroll: true,
  },
  build: {
    output: "dist/index.html",
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});
```

Top-level options:

- `input`: Slate entry file or a named input map.
- `plugins`: Vite-compatible plugins used by Slate dev/build.
- `publicDir`: Static assets directory.
- `html`: Final HTML postprocess and template attribute diagnostic options.
- `dev`: Development server options.
- `build`: Static build options.
- `preview`: Preview server options.
- `vite`: Additional non-plugin Vite options.

During dev, Slate keeps full page reload as the default update strategy because
compiled `.slate` output does not currently have a browser-side component
runtime that can safely patch arbitrary DOM. `dev.preserveScroll` keeps window,
document, and explicitly marked scroll containers stable across those reloads.

Mark scroll containers with a stable key:

```slate
<aside dev:scroll="sidebar">
  ...
</aside>
```

`dev:scroll` requires a static string value and is stripped from production
build output.

## Slate directives

Slate supports compiler directives on normal inline scripts and styles:

```slate
<style is:global>
  body {
    margin: 0;
  }
</style>

<script is:global="head">
  document.documentElement.dataset.theme = localStorage.theme || "light";
</script>

<script is:global>
  window.__SLATE_READY__ = true;
</script>

<script is:inline>
  console.log("inline with this component instance");
</script>
```

Rules:

- `<style is:global>` is injected once before `</head>`.
- `<script is:global="head">` is injected once before `</head>`.
- `<script is:global="tail">` is injected once before `</body>`.
- `<script is:global>` is equivalent to `<script is:global="tail">`.
- `is:inline` keeps the script or style at its template location for every render.
- `is:global` and `is:inline` are not allowed on `<script slate>`.
- `is:global` and `is:inline` are not allowed on `<script src="...">`.

Config values are resolved in this order:

```txt
CLI flags > slate.config.* > defaults
```

Relative paths in config are resolved from the config file directory.

## HTML postprocess

Slate can postprocess the final rendered HTML with rehype:

```ts
import { defineConfig } from "@slate/cli";

export default defineConfig({
  input: "src/App.slate",
  html: {
    format: "minify",
    rehypePlugins: [],
  },
});
```

`html.format` accepts:

- `"preserve"`: Keep rendered HTML as-is. This is the default.
- `"pretty"`: Format final HTML through rehype.
- `"minify"`: Minify final HTML whitespace through rehype.

`html.rehypePlugins` accepts rehype plugins that run before the selected formatter/minifier.

`html.attributeDiagnostics` lets projects add opt-in diagnostics for template
attribute names. Slate does not hard-code React compatibility warnings such as
`className` or `htmlFor`; configure them when your project wants that policy:

```ts
import { defineConfig } from "@slate/cli";

export default defineConfig({
  html: {
    attributeDiagnosticsDefaultSeverity: "warning",
    attributeDiagnostics: [
      "className",
      "htmlFor",
      /^on[A-Z]/,
      {
        pattern: "on*",
        severity: "error",
        message: "Slate does not support runtime event handlers.",
      },
    ],
  },
});
```

Patterns may be exact strings, prefix/suffix wildcard strings such as `on*`, or
regular expressions. `severity` accepts `"warning"`, `"error"`, or `"off"`.
String and regular expression shorthand rules use
`html.attributeDiagnosticsDefaultSeverity` when no per-rule severity is present.

`attributeDiagnosticsDefaultSeverity` supports:

```ts
// Uniform default.
attributeDiagnosticsDefaultSeverity: "error",

// Severity groups for shorthand patterns.
attributeDiagnosticsDefaultSeverity: {
  error: ["className", "htmlFor"],
  warning: [/^on[A-Z]/],
},

// Multiple explicit combinations.
attributeDiagnosticsDefaultSeverity: [
  { severity: "error", patterns: ["className", "htmlFor"] },
  { severity: "warning", patterns: [/^on[A-Z]/] },
],
```

## Multiple inputs

Use an object for `input` to build multiple pages:

```ts
import { defineConfig } from "@slate/cli";

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

Multi-input build writes one HTML file per input name.

Multi-input dev maps `/` to the first input and `/<name>` to each named input.

## Vite integration

Slate uses Vite internally for development, build, preview, public assets, and plugin integration.

Use top-level `plugins` for Vite-compatible Slate plugins and `vite` for non-plugin Vite options:

```ts
import { defineConfig } from "@slate/cli";

export default defineConfig({
  input: "src/App.slate",
  plugins: [],
  vite: {
    define: {
      __APP_VERSION__: JSON.stringify("0.0.0"),
    },
    resolve: {
      alias: {},
    },
  },
});
```

`slate dev` and `slate build` do not load `vite.config.ts` directly. `slate.config.*` is the project configuration entry.

## Dynamic config

Config files can export a config object, a promise, or a function.

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

`command` and `mode` follow Vite's config context model. `phase` is the exact Slate CLI phase:

```txt
slate dev     -> { command: "serve", mode: "development", phase: "dev" }
slate build   -> { command: "build", mode: "production", phase: "build" }
slate preview -> { command: "serve", mode: "production", phase: "preview" }
slate check   -> { command: "serve", mode: "development", phase: "check" }
```

## Public assets

Files in `publicDir` are served by `slate dev` from `/` and copied by `slate build` into the build output directory.

Missing public directories are ignored.

## Programmatic API

```ts
import { defineConfig, runBuild, runCheck, runDev, runPreview } from "@slate/cli";

await runCheck({ config: "slate.config.ts" });
await runBuild({ config: "slate.config.ts" });
```

## Diagnostics

`slate check` prints compiler and type diagnostics with source snippets when source text is available:

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
