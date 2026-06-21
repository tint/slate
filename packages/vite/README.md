# @slate/vite

Vite integration for Slate.

## Status

This package currently provides:

- Vite plugin for transforming `.slate` files.
- `createSlateDevServer` for serving a Slate input through Vite middleware.
- `buildSlate` for building Slate inputs through Vite SSR and writing HTML output.
- `createSlatePreviewServer` for serving built Slate output.
- CSS import collection from `<script slate>`.
- `is:global` asset injection for shared page-level scripts and styles.
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

## Global and inline assets

Slate collects global inline assets during render and injects them into the
final HTML:

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

- `<style is:global>` is injected once before `</head>`.
- `<script is:global="head">` is injected once before `</head>`.
- `<script is:global="tail">` is injected once before `</body>`.
- `<script is:global>` is equivalent to `<script is:global="tail">`.
- `is:global` and `is:inline` are not allowed on `<script src="...">`.
- `is:inline` keeps the asset at the component render location and does not deduplicate it.

CSS imports from `<script slate>` are resolved through Vite and injected as
page-level CSS:

```slate
<script slate>
import "./style.css";
</script>
```

## Dev reload and scroll restoration

Dev servers keep full reload as the safe update model. Slate currently renders
HTML without a browser-side component instance tree, so DOM diffing would risk
breaking user-managed DOM, third-party widgets, canvas/chart state, and event
listener ownership.

Pass `preserveScroll: true` to restore window/document scroll positions and
explicit scroll containers after reload:

```slate
<aside dev:scroll="stable-key">
  ...
</aside>
```

`dev:scroll` is emitted as `data-slate-dev-scroll` only in development output.
Production builds strip all `dev:*` directives.

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
