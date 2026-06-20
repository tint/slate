# @slate/vite

Vite integration for Slate.

## Status

This package currently provides:

- Vite plugin for transforming `.slate` files.
- `createSlateDevServer` for serving a Slate input through Vite middleware.
- `buildSlate` for building Slate inputs through Vite SSR and writing HTML output.
- `createSlatePreviewServer` for serving built Slate output.
- Full-page reload on `.slate` updates.

`createSlateDevServer` and `buildSlate` do not load project-level `vite.config.*` files. Slate projects should pass Vite-compatible plugins through `plugins` and non-plugin Vite options through `vite`.

Programmatic callers can also pass inline Vite config:

```ts
import { buildSlate } from "@slate/vite";

await buildSlate({
  input: "src/App.slate",
  output: "dist/index.html",
  plugins: [],
  vite: {
    define: {
      __BUILD_TARGET__: JSON.stringify("static"),
    },
  },
});
```

Client-side asset bundling will be added later when Slate gets client runtime features.
