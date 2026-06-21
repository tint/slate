import { expect, test } from "vitest";
import { startSlateDevServer } from "../src/index";

test("starts a Slate dev server for browser test runners", async () => {
  const server = await startSlateDevServer({
    root: new URL(".", import.meta.url).pathname,
    input: "App.slate",
    port: 0,
  });

  try {
    expect(server.url).toMatch(/^http:\/\/.+\/$/);
    expect(server.origin).toMatch(/^http:\/\/.+/);
    expect(server.port).toBeGreaterThan(0);
  } finally {
    await server.close();
  }
});
