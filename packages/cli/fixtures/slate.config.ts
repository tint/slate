import { defineConfig } from "../src/index";

export default defineConfig({
  input: {
    index: "basic.slate",
    component: "component/index.slate",
    configured: "configured.slate",
  },
  plugins: [{
    name: "slate-config-test-plugin",
    config() {
      return {
        define: {
          __SLATE_PLUGIN_TEXT__: JSON.stringify("from slate config plugin"),
        },
      };
    },
  }],
  vite: {
    define: {
      __SLATE_CONFIG_DEFINE__: JSON.stringify("from slate config vite"),
    },
  },
  html: {
    format: "preserve",
  },
  publicDir: "public",
  dev: {
    port: 0,
    preserveScroll: true,
  },
  build: {
    output: "../.tmp/config-build",
    tmpDir: "../.tmp/config-build-modules",
  },
});
