# slate-zed

Zed language extension metadata for Slate.

## Responsibility

- Register `.slate` as a language for Zed.
- Register `@slate/language-server` as the language server backend.
- Provide a baseline syntax configuration.
- Keep editor integration metadata close to source control for tooling.

## Runtime behavior

This package provides a first-step metadata package. Zed will read the extension
manifest and language configuration and use your user/workspace settings to launch
`@slate/language-server`.

## Files

- `extension.toml` — minimal extension manifest.
- `languages/slate/config.toml` — language mapping for `.slate` files.
- `src/index.ts` — shared constants and helpers to generate/inspect the same values from TypeScript tooling.

## Usage for users

Configure in `~/.config/zed/settings.json` (or workspace settings) similar to:

```json
{
  "languages": {
    "Slate": {
      "language_servers": ["slate-language-server"]
    }
  },
  "lsp": {
    "slate-language-server": {
      "binary": {
        "path": "bun",
        "arguments": [
          "./node_modules/@slate/language-server/src/index.ts"
        ]
      }
    }
  }
}
```

## Notes

Automatic binary resolution from the extension binary is not yet wired to a Rust
shim in this repository. This is a practical first step before adding a
`zed_extension_api` bridge in a follow-up iteration.

## Status

Implemented as a non-empty starter package with editor metadata and TS helper exports.
