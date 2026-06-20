# @slate/language-server

Language Server Protocol implementation for Slate.

## Responsibility

- Provide diagnostics from `@slate/check`.
- Use `vscode-languageserver` for stdio-based LSP initialization and JSON-RPC handling.
- Use `vscode-languageserver-textdocument` for document synchronization and offset/position conversion.
- Provide diagnostics on `textDocument/didOpen` and `textDocument/didChange`.
- Provide completion, hover, definition, and document symbol features.
- Keep language logic in `@slate/compiler` and `@slate/check`.
- Reuse `@slate/ts-plugin` virtual document helpers for `<script slate>` TypeScript views.

## Status

Implemented with CST-backed source parsing, check integration, virtual TypeScript script mapping, and official LSP runtime packages.

## Notes

The language server should not maintain a separate model for `<script slate>`.
Script extraction and offset mapping should go through `@slate/ts-plugin` so editor
features and TypeScript integration stay aligned.

Protocol framing, request dispatch, incremental text synchronization, and diagnostics
publishing should stay delegated to the `vscode-languageserver` package family.
