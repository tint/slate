# @slate/test

Testing helpers for Slate render modules.

## Install

```sh
npx jsr add -D @slate/test
```

For Vitest, also use the Slate Vite plugin so tests can import `.slate` files:

```ts
import { defineConfig } from "vitest/config";
import { slate } from "@slate/vite";

export default defineConfig({
  plugins: [slate()],
});
```

Slate does not require a specific test environment for `renderSlate()`. Use your
test runner's DOM or browser environment only when your own assertions need
browser APIs.

## `renderSlate`

```ts
import { expect, test } from "vitest";
import { renderSlate } from "@slate/test";
import App from "./App.slate";

test("renders", async () => {
  await expect(renderSlate(App)).resolves.toContain("<h1>Hello</h1>");
});
```

`renderSlate` creates a Slate render context, renders the component, injects any
collected global assets, and returns the final HTML string.

```ts
const html = await renderSlate(App, {
  props: {
    title: "Hello",
  },
  slots: {
    default: async () => "<p>Content</p>",
  },
});
```

Slot data and `$provide` / `$inject` context values use Slate runtime reference
semantics. `renderSlate` does not clone them for tests, so mutations behave the
same way they do during dev and build rendering.

Collected assets from `is:global` are injected into the returned HTML:

- global styles before `</head>`
- `is:global="head"` scripts before `</head>`
- `is:global` and `is:global="tail"` scripts before `</body>`

## Boundary

`@slate/test` is framework-agnostic. It does not own `.slate` transforms.
Vitest support comes from `@slate/vite`.

## `startSlateDevServer`

`startSlateDevServer` starts a Slate dev server for browser-based tests. It is
test-runner agnostic and does not import Playwright or any browser automation
library.

```ts
import { test, expect } from "@playwright/test";
import { startSlateDevServer } from "@slate/test";

let server: Awaited<ReturnType<typeof startSlateDevServer>>;

test.beforeAll(async () => {
  server = await startSlateDevServer({
    root: new URL(".", import.meta.url).pathname,
    input: "src/App.slate",
    preserveScroll: true,
  });
});

test.afterAll(async () => {
  await server.close();
});

test("renders in a browser", async ({ page }) => {
  await page.goto(server.url);
  await expect(page.locator("h1")).toHaveText("Hello");
});
```

`preserveScroll` enables the same development full-reload scroll restoration
used by `@slate/vite`. Mark explicit scroll containers with
`dev:scroll="stable-key"` in `.slate` templates.
