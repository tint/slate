import { expect, test } from "vitest";
import { renderSlate } from "../src/index";
import App from "./App.slate";

test("renders a Slate component with props, slots, and global assets", async () => {
  const html = await renderSlate(App, {
    props: {
      title: "Vitest",
    },
    slots: {
      default: async () => "<p>Slot content</p>",
    },
  });

  expect(html).toContain("<style>");
  expect(html).toContain("body");
  expect(html).toContain("<h1>Vitest</h1>");
  expect(html).toContain("<p>Slot content</p>");
});
