import { defineConfig } from "vitest/config";
import { slate } from "@slate/vite";

export default defineConfig({
  plugins: [slate()],
  test: {
    include: ["fixtures/**/*.test.ts"],
  },
});
