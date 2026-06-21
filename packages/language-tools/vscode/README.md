# Slatejs for VS Code

Language support for Slate `.slate` files.

## Features

- Syntax highlighting for `.slate` templates.
- TypeScript highlighting inside `<script slate>`.
- CSS highlighting inside `<style>`.
- Diagnostics for Slate parser, template, rune, and TypeScript issues.
- Completion for Slate blocks, directives, runes, slots, and common template attributes.
- Hover documentation for Slate syntax and runtime runes.
- Go to definition for symbols that can be resolved by the Slate language server.
- Document symbols for scripts, template bindings, and block scopes.
- Semantic highlighting for Slate-owned syntax.

## Supported syntax

Template blocks:

```slate
{#if visible}
  <p>Visible</p>
{:else}
  <p>Hidden</p>
{/if}

{#each items as item, index}
  <p>{index}: {item}</p>
{/each}
```

Runes:

```slate
<script slate>
const title = $prop("title", "Untitled");
const values = $props<{ count?: number }>();

$provide("theme", {
  color: "blue",
});
</script>
```

Slots:

```slate
<slot name="header" data={{ title }} />

<Card>
  <header slot:header={{ title }}>Header</header>
</Card>
```

Compiler directives:

```slate
<style is:global>
  body {
    margin: 0;
  }
</style>

<script is:global="head">
  document.documentElement.dataset.theme = "light";
</script>

<script is:global>
  window.__SLATE_READY__ = true;
</script>

<script is:inline>
  console.log("inline with this component instance");
</script>
```

Development-only directives:

```slate
<aside dev:scroll="sidebar">
  ...
</aside>
```

## Completions

The extension provides snippets for:

- `{#if}`
- `{#each}`
- `{#await}`
- `{@html}`
- `{@debug}`
- `$prop`
- `$props`
- `$inject`
- `$provide`
- `slot:`
- `is:`
- `dev:scroll`
- `class=`
- `style=`
- `<Fragment>`
- `<slot>`
- `<script slate>`

## Hover

Hover works for:

- TypeScript symbols in `<script slate>`.
- Template expressions.
- Each block bindings.
- Slate runes such as `$prop` and `$provide`.
- Slate template keywords such as `{#if}` and `{#each}`.
- Slots and slot directives.
- Compiler directives such as `is:global` and `is:inline`.
- Development directives such as `dev:scroll`.
- Imported `.slate` components.

When possible, Slate-specific documentation is shown before raw TypeScript details.

## Settings

The extension starts the bundled Slate language server by default.

You usually do not need to configure anything.

Available settings:

```json
{
  "slate.languageServer.command": "",
  "slate.languageServer.args": []
}
```

Use these settings only when you want to run a custom language server.

Example:

```json
{
  "slate.languageServer.command": "node",
  "slate.languageServer.args": [
    "/absolute/path/to/language-server.js",
    "--stdio"
  ]
}
```

## Notes

The extension includes a bundled Slate language server. You do not need to
install `@slate/language-server` separately.
