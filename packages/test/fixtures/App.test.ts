import { expect, test } from "vitest";
import { html } from "@slate/kit";
import { renderSlate } from "../src/index";
import App from "./App.slate";

test("renders a Slate component with props, slots, and global assets", async () => {
  const output = await renderSlate(App, {
    props: {
      title: "Vitest",
    },
    slots: {
      default: async () => html("<p>Slot content</p>"),
    },
  });

  expect(output).toContain("<style>");
  expect(output).toContain("body");
  expect(output).toContain("<h1>Vitest</h1>");
  expect(output).toContain("<p>Slot content</p>");
});
