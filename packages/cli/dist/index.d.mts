import { t as run } from "./commands-CmBh3DnO.mjs";
import { i as defineConfig, n as ResolvedSlateInput, r as SlateConfig, t as ResolvedSlateConfig } from "./config-B-WRppiv.mjs";

//#region src/commands/build.d.ts
type BuildOptions = {
  input?: string;
  config?: string;
  output?: string;
  out?: string;
  tmpDir?: string;
  publicDir?: string;
  kit?: string;
};
declare function runBuild(options?: BuildOptions): Promise<void>;
//#endregion
//#region src/commands/check.d.ts
type CheckOptions = {
  input?: string;
  config?: string;
};
declare function runCheck(options?: CheckOptions): Promise<void>;
//#endregion
//#region src/commands/dev.d.ts
type DevOptions = {
  input?: string;
  config?: string;
  port?: number | string;
  host?: string;
  tmpDir?: string;
  publicDir?: string;
  reload?: boolean;
  kit?: string;
};
declare function runDev(options?: DevOptions): Promise<void>;
//#endregion
//#region src/commands/preview.d.ts
type PreviewOptions = {
  config?: string;
  dir?: string;
  port?: number | string;
  host?: string;
};
declare function runPreview(options?: PreviewOptions): Promise<void>;
//#endregion
//#region src/scaffold.d.ts
type InitOptions = {
  force?: boolean;
};
/** Scaffold a minimal Slate project. */
declare function runInit(targetArg: string, options?: InitOptions): Promise<void>;
//#endregion
export { type BuildOptions, type CheckOptions, type DevOptions, type InitOptions, type PreviewOptions, type ResolvedSlateConfig, type ResolvedSlateInput, type SlateConfig, defineConfig, run, runBuild, runCheck, runDev, runInit, runPreview };