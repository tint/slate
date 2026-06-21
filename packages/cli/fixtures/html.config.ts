import { defineConfig } from "../src/index";

export default defineConfig({
  input: "html.slate",
  html: {
    format: "minify",
  },
  build: {
    output: "../.tmp/html-config-build/index.html",
    tmpDir: "../.tmp/html-config-build-modules",
  },
});
