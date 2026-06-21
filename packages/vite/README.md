# @slate/vite

Vite integration for Slate.

## Status

This package currently provides:

- Vite plugin for transforming `.slate` files.
- `createSlateDevServer` for serving a Slate input through Vite middleware.
- `buildSlate` for building Slate inputs through Vite SSR and writing HTML output.
- `createSlatePreviewServer` for serving built Slate output.
- Full-page reload on `.slate` updates.
- Optional scroll restoration across dev full reloads with `preserveScroll`.

`createSlateDevServer` and `buildSlate` do not load project-level `vite.config.*` files. Slate projects should pass Vite-compatible plugins through `plugins` and non-plugin Vite options through `vite`.

Programmatic callers can also pass inline Vite config:

```ts
import { buildSlate } from "@slate/vite";

await buildSlate({
  input: "src/App.slate",
  output: "dist/index.html",
  plugins: [],
  html: {
    format: "minify",
  },
  vite: {
    define: {
      __BUILD_TARGET__: JSON.stringify("static"),
    },
  },
});
```

`html.format` supports `"preserve"`, `"pretty"`, and `"minify"`. `html.rehypePlugins` can be used to run additional rehype transforms on the final rendered HTML.

Dev servers keep full reload as the safe update model. Pass `preserveScroll: true`
to restore window/document scroll positions and elements rendered with
`dev:scroll="stable-key"` after reload.

## Vitest

Vitest can import `.slate` files through the Slate Vite plugin:

```ts
import { defineConfig } from "vitest/config";
import { slate } from "@slate/vite";

export default defineConfig({
  plugins: [slate()],
});
```

Use `@slate/test` to render imported components in assertions.

Client-side asset bundling will be added later when Slate gets client runtime features.
