import { SlatePlugin, SlateViteUserConfig } from "@slate/vite";

//#region src/config.d.ts
/** User-authored `slate.config.*` shape. */
type SlateConfig = {
  input?: string | Record<string, string>;
  plugins?: SlatePlugin[];
  vite?: SlateViteUserConfig;
  publicDir?: string;
  dev?: {
    host?: string;
    port?: number;
    tmpDir?: string;
    reload?: boolean;
  };
  build?: {
    output?: string;
    tmpDir?: string;
  };
  preview?: {
    host?: string;
    port?: number;
  };
  kit?: {
    specifier?: string;
  };
};
/** Fully resolved config after defaults and config-relative paths are applied. */
type ResolvedSlateConfig = {
  configPath?: string;
  input: ResolvedSlateInput[];
  plugins: SlatePlugin[];
  vite?: SlateViteUserConfig;
  publicDir?: string;
  dev: {
    host: string;
    port: number;
    tmpDir: string;
    reload: boolean;
  };
  build: {
    output?: string;
    tmpDir: string;
  };
  preview: {
    host: string;
    port: number;
  };
  kit: {
    specifier: string;
  };
};
type ResolvedSlateInput = {
  name: string;
  path: string;
};
/** Type helper for `slate.config.ts`. */
declare function defineConfig(config: SlateConfig): SlateConfig;
/** Load Slate config, applying CLI config selection and config-relative paths. */
declare function loadConfig(configFile?: string): Promise<ResolvedSlateConfig>;
//#endregion
export { loadConfig as a, defineConfig as i, ResolvedSlateInput as n, SlateConfig as r, ResolvedSlateConfig as t };