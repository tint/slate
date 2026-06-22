# @slate/compiler

Core Slate compiler.

## Responsibility

- Parse `.slate` files.
- Extract and analyze `<script slate>` TypeScript.
- Parse Slate template syntax.
- Build the Slate AST.
- Resolve imported Slate components.
- Compile templates into render modules.
- Emit compiler diagnostics.

## Status

This package currently implements the first Slate compile loop:

```txt
.slate source -> AST -> render module code
```

It also emits parser/analyzer/codegen diagnostics used by CLI and language tooling.

## Public API

Primary entry point:

```ts
compile(source, {
  filename: "entry.slate",
  sourcemap: true,
});
```

The compiler should be usable by `@slate/kit`, `@slate/cli`, `@slate/check`, and editor tooling.

## Runtime error mapping

Runtime render errors map generated JavaScript failures back to `.slate` source ranges for expression-level template code.

Generated code wraps expression evaluation:

```ts
evaluateSlateExpression(() => expression, {
  filename: "entry.slate",
  range: { start: 0, end: 10 },
  kind: "template",
});
```

This throws a structured `SlateRenderError` that CLI and integrations can format with source snippets.

Covered expression kinds:

- template expressions
- HTML directives
- if/each expressions
- expression attributes
- component prop expressions
- slot data expressions

## Source maps

The compiler can emit standard v3 source maps for generated render modules:

```ts
const result = compile(source, {
  filename: "entry.slate",
  sourcemap: true,
});
```

Supported values:

- `false` or `undefined`: no source map.
- `true`: return `result.map` without appending a sourceMappingURL comment.
- `"hidden"`: return `result.map` without appending a sourceMappingURL comment.
- `"inline"`: return `result.map` and append an inline sourceMappingURL data URL.

The map is segment-level. It maps Slate expressions back to source ranges, but
does not map generated helper code or final HTML output.

Vite/Rolldown and CLI integrations are responsible for deciding whether to
write sidecar `.map` files or pass maps through a bundler pipeline.

## Compiler directives

Slate compiler directives are parsed and validated by this package.

### `is:global`

`is:global` marks normal inline `<script>` and `<style>` blocks as shared
page-level assets.

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
```

Rules:

- `is:global` is allowed only on normal inline `<script>` and `<style>` blocks.
- `is:global` is not allowed on `<script slate>`.
- `is:global` is not allowed on `<script src="...">`.
- `<style is:global>` must not have a value.
- `<style is:global>` is collected once and injected before `</head>`.
- `<script is:global="head">` is collected once and injected before `</head>`.
- `<script is:global="tail">` is collected once and injected before `</body>`.
- `<script is:global>` is equivalent to `<script is:global="tail">`.
- Global assets are deduplicated by generated output and injection position.

### `is:inline`

`is:inline` marks normal inline `<script>` and `<style>` blocks as per-instance
output.

```slate
<style is:inline>
  .card {
    color: red;
  }
</style>

<script is:inline>
  console.log("rendered with this component instance");
</script>
```

Rules:

- `is:inline` is allowed only on normal inline `<script>` and `<style>` blocks.
- `is:inline` is not allowed on `<script slate>`.
- `is:inline` is not allowed on `<script src="...">`.
- `is:inline` must not have a value.
- `is:global` and `is:inline` are mutually exclusive.
- Inline assets are emitted at their template location every time the component renders.

### `dev:scroll`

`dev:scroll` marks a scroll container that can be restored after Vite full
reload during development.

```slate
<aside dev:scroll="sidebar">
  ...
</aside>
```

Rules:

- `dev:scroll` is allowed only on normal template elements.
- `dev:scroll` requires a stable static string value.
- In dev output, it becomes `data-slate-dev-scroll="sidebar"`.
- In production build output, all `dev:*` directives are stripped.
