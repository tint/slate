# Slate Architecture

## Workspace layout

Slate uses Bun for dependency management and workspace installation.

Slate packages should remain Node-compatible. Bun is not part of the runtime contract.

Runtime packages publish TypeScript source to JSR and should not require committed build output. Editor extension packages may still build bundled artifacts for their host editors.

```txt
internal/
|- bump                     @internal/bump

packages/
|- compiler                 @slate/compiler
|- kit                      @slate/kit
|- vite                     @slate/vite
|- test                     @slate/test
|- cli                      @slate/cli
|- language-tools/
|  |- check                 @slate/check
|  |- language-server       @slate/language-server
|  |- ts-plugin             @slate/ts-plugin
|  |- vscode                slate-vscode
|  |- zed                   slate-zed
```

Root workspace configuration:

```json
{
  "workspaces": [
    "internal/*",
    "packages/*",
    "packages/language-tools/*"
  ]
}
```

The root `package.json` is also treated as a workspace package by internal version tooling.

## Package responsibilities

### `@slate/compiler`

Core compiler package.

Responsibilities:

- Parse `.slate` files.
- Parse and transform `<script slate>` TypeScript.
- Build Slate template AST.
- Analyze component imports.
- Compile template syntax.
- Compile slots and slot data.
- Generate render modules.
- Provide diagnostics required by compiler consumers.

This package should not depend on CLI or editor packages.

### `@slate/kit`

Public framework package.

Responsibilities:

- Expose user-facing Slate APIs.
- Provide runtime helpers used by compiled output.
- Provide render helpers.
- Provide integration surfaces for bundlers and frameworks.
- Re-export stable compiler types when useful for users.

This package is the primary dependency for Slate applications.

### `@slate/vite`

Vite integration package.

Responsibilities:

- Provide the Slate Vite plugin.
- Transform `.slate` files through `@slate/compiler`.
- Integrate Slate render modules with the Vite dev server.
- Use Vite for dev server, public assets, HMR/full reload, build, and preview workflows where possible.
- Own Slate dev, build, and preview orchestration used by the CLI.
- Provide programmatic helpers that `@slate/cli` can call.

This package should own Vite-specific behavior. The CLI should call into this package instead of reimplementing Vite features.

### `@slate/test`

Testing helper package.

Responsibilities:

- Provide framework-agnostic test helpers for compiled Slate components.
- Provide `renderSlate()` for rendering a component with props, slots, and a test context.
- Inject collected global assets so test output matches build/dev render output.
- Document Vitest usage through `@slate/vite`.

This package should not own `.slate` transforms. Test runner integration should use bundler packages such as `@slate/vite`.

### `@slate/cli`

Command-line interface.

Responsibilities:

- Provide the `slate` binary.
- Expose `slate dev`.
- Expose `slate build`.
- Expose `slate preview`.
- Implement `slate check`.
- Load project config.
- Coordinate Vite, compiler, kit, and language-tool packages.

The CLI should be thin. Core behavior should live in reusable packages.

### `@slate/check`

Static checking package.

Responsibilities:

- Validate `.slate` files.
- Provide type-aware diagnostics.
- Validate template expressions.
- Validate slot usage.
- Validate rune usage.
- Validate compiler directives.
- Expose diagnostics for CLI and language server consumers.

This package should reuse `@slate/compiler` parsing and analysis primitives.

### `@slate/language-server`

Language Server Protocol package.

Responsibilities:

- Provide the Slate LSP server.
- Serve diagnostics from `@slate/check`.
- Provide completions.
- Provide hover information.
- Provide go-to-definition where possible.
- Provide document symbols.
- Provide semantic tokens for Slate-owned syntax.
- Provide formatting hooks when available.

This package should not duplicate compiler parsing logic.

### `@slate/ts-plugin`

TypeScript plugin package.

Responsibilities:

- Improve TypeScript editor integration for `.slate` files.
- Provide virtual TypeScript documents.
- Support type checking for `<script slate>`.
- Support type inference for props, slots, and runes.
- Expose `.slate` component modules as user-facing `Component<Props, Slots>` types.
- Coordinate with `@slate/check` where possible.

### `slate-vscode`

VS Code extension package.

Responsibilities:

- Register `.slate` language support.
- Start and manage `@slate/language-server`.
- Provide syntax highlighting.
- Provide local Extension Host and VSIX development workflows.
- Provide editor commands.
- Package VS Code marketplace assets.

### `slate-zed`

Zed extension package.

Responsibilities:

- Register `.slate` language support in Zed.
- Start and manage `@slate/language-server`.
- Provide syntax highlighting.
- Package Zed extension assets.

### `@internal/bump`

Internal workspace version bump helper.

Responsibilities:

- Interactively bump workspace package versions.
- Support the root workspace package, `packages/*`, `packages/language-tools/*`, and `internal/*`.
- Generate package-scoped changelog entries from git commit subjects.
- Update package `version` fields.
- Update matching `jsr.json` versions when present.
- Update package `CHANGELOG.md` files.
- Update internal `workspace:` dependency ranges for bumped packages.

This package must not publish packages. Publishing should remain a separate explicit operation.

Preconditions:

- The workspace root must be the git repository root.
- The selected package path must not contain uncommitted changes.

## Dependency direction

Recommended dependency direction:

```txt
@slate/compiler
  <- @slate/check
  <- @slate/language-server

@slate/compiler
  <- @slate/kit
  <- @slate/vite
  <- @slate/cli

@slate/kit
  <- @slate/test

@slate/check
  <- @slate/cli
  <- @slate/language-server

@slate/language-server
  <- slate-vscode
  <- slate-zed
```

Rules:

- `@slate/compiler` is the lowest-level core package.
- `@slate/vite` owns Vite integration and should be the long-term home for dev/build/preview orchestration.
- Editor packages must not implement their own parser.
- CLI should compose reusable packages instead of owning core behavior.
- Shared types should live in the package that owns the corresponding behavior.
- Internal tooling packages must not be runtime dependencies of public Slate packages.

## Initial implementation order

Recommended order:

1. `@slate/compiler`
2. `@slate/kit`
3. `@slate/vite`
4. `@slate/test`
5. `@slate/cli`
6. `@slate/check`
7. `@slate/language-server`
8. `@slate/ts-plugin`
9. `slate-vscode`
10. `slate-zed`

The compiler should come first because every other package depends on its syntax model and diagnostics.

Internal tooling such as `@internal/bump` is not part of the runtime implementation order.

## Vite integration direction

The CLI originally had hand-written dev/build/preview implementations. Dev, build, and preview are now delegated to `@slate/vite`.

Long-term direction:

- `@slate/vite` owns Vite plugin behavior and dev/build/preview orchestration.
- `@slate/cli` loads `slate.config.*`, maps it to Vite options, and delegates to `@slate/vite`.
- Vite should own static asset serving, production build, preview serving, HMR/full reload, environment handling, and plugin ecosystem integration.
- `@slate/compiler` remains independent of Vite.

Initial `@slate/vite` MVP:

- `slate()` Vite plugin transforms `.slate` files through `@slate/compiler`.
- `createSlateDevServer()` creates a Vite dev server and renders a Slate input through Vite middleware.
- `buildSlate()` owns Slate HTML output orchestration.
- `createSlatePreviewServer()` serves built Slate output.
- `.slate` hot updates trigger a full page reload.

## Editor DX contract

The VS Code extension currently supports:

- TextMate highlighting for `.slate` templates.
- Embedded TypeScript highlighting inside `<script slate>`.
- Embedded CSS highlighting inside `<style>`.
- Diagnostics from `@slate/check`.
- TypeScript-powered hover, completion, and definition.
- Slate-specific hover docs for runes, template keywords, slots, `<script slate>`, `is:*`, `class`, `style`, and `<Fragment>`.
- Completion snippets for `{#`, `{@`, `$`, `slot:`, `is:`, `class=`, `style=`, and `<`.
- Semantic tokens for runes, template keywords, each bindings, slot directives, `is:*`, `<script slate>`, and `<Fragment>`.

The extension must work before any `@slate/*` package is published. For local VSIX builds, `slate-vscode` bundles the Slate language server into `dist/server.mjs`.

TypeScript is intentionally kept as a VSIX runtime dependency instead of being bundled, because semantic diagnostics need TypeScript's default `lib.*.d.ts` files.

## `.slate` component type model

Imported `.slate` files should expose a user-facing component type:

```ts
export type Props = {};
export type Slots = {};

export type Component<TProps, TSlots> = {
  render(props?: TProps, slots?: TSlots, context?: unknown): Promise<string>;
};

declare const component: Component<Props, Slots>;
export default component;
```

Rules:

- Explicit `export type Props` in `<script slate>` wins over inferred props.
- Explicit `export type Slots` in `<script slate>` wins over inferred slots.
- `$prop("title", "Untitled")` infers an optional widened prop: `{ title?: string }`.
- `$prop<number>("count")` infers a required typed prop: `{ count: number }`.
- `$props<T>()` and `$props<T>({...})` are intersected into inferred `Props`.
- `<slot name="header" data={{ title, count }} />` infers structured slot data: `{ header?: (data: { title: typeof title; count: typeof count }) => unknown }`.
- `<slot />` infers the default slot with `data?: undefined`.
- Internal helper names such as `__Slate*` should not be the primary type shown to users in editor hover.
- Component type inference is editor/type-checker metadata generated by `@slate/ts-plugin`; it does not change runtime compiler output.

## Local validation

Current stable validation commands:

```sh
bun run test:all
bun run vscode:package
```

Internal version metadata is managed with:

```sh
bun run bump
```

`bun run bump` requires the workspace root to be the git repository root and the selected package path to be clean.

## Runtime errors and diagnostics

Slate has two different error channels:

- Compile-time diagnostics: parser, analyzer, and TypeScript diagnostics.
- Runtime render errors: exceptions thrown while executing generated render modules.

Compile-time diagnostics are mapped through CST ranges and virtual TypeScript document mappings. Runtime render errors use structured source metadata because JavaScript stack traces naturally point at generated `.mjs` files.

### Diagnostic formatting

`@slate/compiler` owns the shared diagnostic formatter. When source text is available, diagnostics include a source line and caret marker:

```txt
entry.slate:5:5: error: null is not an object (evaluating 'user.name')
  <p>{user.name}</p>
      ^^^^^^^^^
```

When source text is unavailable, formatting falls back to a compact single-line message:

```txt
entry.slate: error: message
```

Consumers should reuse `formatDiagnostic` instead of formatting compiler/check/runtime ranges independently.

### Goals

- CLI render/build failures should point back to `.slate` files.
- LSP and CLI should reuse the same source-location metadata.
- Runtime errors from template expressions should identify the expression range.
- Runtime errors from `<script slate>` initialization should identify the script statement or expression where possible.
- The design should not require bundlers to understand Slate internals.

### Non-goals for the first implementation

- Full browser devtools source-map integration.
- Perfect stack remapping across minified bundles.
- Runtime recovery after a failed render.

### Implemented runtime mapping layer

The first implementation uses expression-level wrappers. Template expressions are compiled with source metadata:

```slate
<p>{user.name}</p>
```

Generated output wraps expression evaluation:

```ts
evaluateSlateExpression(() => user.name, {
  filename: "entry.slate",
  range: { start: 42, end: 51 },
  kind: "template",
});
```

If the expression throws, `evaluateSlateExpression` throws a `SlateRenderError` that preserves the original error and adds `.filename`, `.range`, and `.kind`.

Current coverage:

- `{expression}`
- `{@html expression}`
- `{#if expression}`
- `{#each expression as item}`
- expression attributes, including `class={...}` and `style={...}`
- component prop expressions
- `<slot data={...}>`

Runtime mapping is intentionally expression-scoped. The compiler should not wrap whole component renders or whole slot renders, because that would hide more precise errors thrown inside child components or slot functions.

### Standard source maps later

Standard source maps can be added later for devtools and generated-module debugging. This should be additive, not a replacement for structured Slate errors, because CLI and editor integrations need stable Slate-owned ranges.

### Error shape

Runtime errors should use a stable public shape:

```ts
type SlateRenderError = Error & {
  cause: unknown;
  filename: string;
  range: { start: number; end: number };
  kind: "script" | "template" | "slot" | "component";
};
```

This shape can be consumed by:

- `@slate/cli`
- `@slate/language-server`
- framework integrations
- test harnesses

### CLI behavior

`slate check` formats static diagnostics through `formatDiagnostic`.

`slate build` catches `SlateRenderError`, converts it to the same diagnostic shape, and formats it through `formatDiagnostic`. Unknown runtime errors are re-thrown so programming errors still surface normally.
