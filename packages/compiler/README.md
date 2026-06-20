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

Standard source maps can be added later once compiler sidecar mappings are stable.
