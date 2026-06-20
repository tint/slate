import type { InlineConfig, PluginOption } from "vite";

/** A single Slate entry or a named multi-entry map. Named entries become route/build output names. */
export type SlateViteInput = string | Record<string, string>;

/** Slate plugins intentionally use Vite's plugin shape so existing Vite plugins can be reused. */
export type SlatePlugin = PluginOption;

/**
 * Vite options accepted from Slate config.
 *
 * `plugins` and `configFile` are intentionally excluded: Slate owns the plugin
 * list through top-level `plugins`, and CLI users should not have a second
 * implicit `vite.config.*` entrypoint.
 */
export type SlateViteUserConfig = Omit<InlineConfig, "plugins" | "configFile">;

/** Options for the Vite-powered Slate development server. */
export type SlateViteOptions = {
  root?: string;
  input: SlateViteInput;
  publicDir?: string | false;
  reload?: boolean;
  kitSpecifier?: string;
  plugins?: SlatePlugin[];
  vite?: SlateViteUserConfig;
  server?: {
    host?: string;
    port?: number;
  };
};

/** Options for rendering Slate inputs to static HTML through a Vite SSR build. */
export type SlateBuildOptions = {
  root?: string;
  input: SlateViteInput;
  output?: string;
  tmpDir?: string;
  publicDir?: string | false;
  kitSpecifier?: string;
  plugins?: SlatePlugin[];
  vite?: SlateViteUserConfig;
  onBuilt?: (outputPath: string) => void;
  onError?: (message: string) => void;
};

/** Options for serving already-built Slate output. */
export type SlatePreviewOptions = {
  root?: string;
  dir?: string;
};

/** Options for the internal `.slate` Vite transform plugin. */
export type SlatePluginOptions = {
  kitSpecifier?: string;
};

/** Internal normalized input used by dev/build routing. */
export type NormalizedInput = {
  name: string;
  path: string;
};
