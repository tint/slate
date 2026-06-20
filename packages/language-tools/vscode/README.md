# slate-vscode

VS Code extension for Slate `.slate` files.

## Features

- Registers `.slate` as the Slate language.
- Provides TextMate syntax highlighting for Slate templates.
- Embeds TypeScript highlighting inside `<script slate>`.
- Embeds CSS highlighting inside `<style>`.
- Starts the Slate language server over stdio.
- Provides diagnostics, completion, hover, definition, document symbols, and semantic tokens through LSP.

## Language features

Hover:

- TypeScript hover for script and template expressions.
- Slate docs for `$prop`, `$props`, `$inject`, and `$provide`.
- Slate docs for `{#if}`, `{#each}`, `{#await}`, `{@html}`, `{@debug}`, `{const}`, and `{let}`.
- Slate docs for `<slot>`, `slot:*`, `<script slate>`, `is:*`, `class`, `style`, and `<Fragment>`.
- `.slate` component imports are shown as Slate components before raw TypeScript details.

Completion:

- `{#` block snippets.
- `{@` directive snippets.
- `$` rune snippets.
- `slot:` slot directive snippets.
- `is:` compiler directive snippets.
- `class=` and `style=` Slate attribute snippets.
- `<` snippets for `Fragment`, `slot`, and `script slate`.

Semantic tokens:

- Runes.
- Template keywords.
- Each block bindings.
- Slot directives.
- `is:*` directives.
- `<script slate>`.
- `<Fragment>`.

## Repository development

From the repository root:

```sh
bun install
bun run vscode:dev
```

This builds the workspace and opens this extension package in VS Code.

Then press `F5` in VS Code. The Extension Development Host will start with the local Slate extension enabled.

The debug configuration opens `examples/workspace` automatically. Open `App.slate` there to test syntax highlighting and language server features.

## Local VSIX package

From the repository root:

```sh
bun run vscode:package
```

This creates:

```txt
packages/language-tools/vscode/slate-vscode.vsix
```

The VSIX includes a bundled Slate language server at `dist/server.mjs`, so local testing does not require publishing `@slate/*` packages to npm.

The TypeScript package is kept as a runtime dependency instead of being bundled, because the language server needs TypeScript's default `lib.*.d.ts` files for correct semantic diagnostics.

Install it manually with:

```sh
code --install-extension packages/language-tools/vscode/slate-vscode.vsix --force
```

## Configuration

Settings:

- `slate.languageServer.command`
- `slate.languageServer.args`

By default, `slate.languageServer.command` is empty. In that mode the extension starts the bundled server from `dist/server.mjs`.

Set `slate.languageServer.command` only when you want to override the server runtime manually.

Example:

```json
{
  "slate.languageServer.command": "bun",
  "slate.languageServer.args": [
    "/absolute/path/to/packages/language-tools/language-server/src/index.ts",
    "--stdio"
  ]
}
```

## Package boundary

This package owns VS Code integration only.

Slate language semantics live in:

- `@slate/compiler`
- `@slate/check`
- `@slate/ts-plugin`
- `@slate/language-server`
