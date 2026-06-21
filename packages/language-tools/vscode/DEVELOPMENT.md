# slate-vscode development

Internal development and publishing notes for the Slate VS Code extension.

This file is not intended for Marketplace users. Keep user-facing extension
documentation in `README.md`.

## Local VSIX install

From the repository root:

```sh
bun run vscode:package
code --install-extension packages/language-tools/vscode/slate-vscode.vsix --force
```

The generated VSIX includes the bundled Slate language server at `dist/server.mjs`.

TypeScript is kept as a runtime dependency because the language server needs
TypeScript's default `lib.*.d.ts` files for semantic diagnostics.

## Repository development

From the repository root:

```sh
bun install
bun run vscode:dev
```

Then press `F5` in VS Code to open an Extension Development Host.

The debug workspace opens `examples/workspace`. Open `App.slate` there to test
syntax highlighting, diagnostics, completion, hover, definition, document
symbols, and semantic tokens.

## Publishing

Package a VSIX:

```sh
bun run vscode:package
```

Publish a prerelease build:

```sh
bun run --cwd packages/language-tools/vscode publish:pre
```

The extension bundles the workspace language server during build. It does not
depend on users installing `@slate/language-server` separately.

## Package boundary

This package owns VS Code integration only.

Slate language semantics live in:

- `@slate/compiler`
- `@slate/check`
- `@slate/ts-plugin`
- `@slate/language-server`
