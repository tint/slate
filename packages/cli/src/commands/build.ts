import { resolve } from "node:path";
import { buildSlate } from "@slate/vite";
import { resolveInputs } from "../args.ts";
import { loadConfig } from "../config.ts";

export type BuildOptions = {
  input?: string;
  config?: string;
  output?: string;
  out?: string;
  tmpDir?: string;
  publicDir?: string;
  kit?: string;
};

export async function runBuild(options: BuildOptions = {}): Promise<void> {
  const config = await loadConfig(options.config, {
    command: "build",
    mode: "production",
    phase: "build",
  });
  const input = resolveInputs(options.input, config.input);
  const outputFlag = options.output ?? options.out;
  const output = outputFlag ? resolve(outputFlag) : config.build.output ?? resolve(input.length > 1 ? "dist" : "dist/index.html");
  const tmpDir = resolve(options.tmpDir ?? config.build.tmpDir);
  const kitSpecifier = options.kit ?? config.kit.specifier;
  const publicDir = options.publicDir ? resolve(options.publicDir) : config.publicDir;

  if (!input.length) {
    throw new Error("Missing input file. Usage: slate build [input.slate] [--output dist/index.html]");
  }

  const ok = await buildSlate({
    root: process.cwd(),
    input: Object.fromEntries(input.map((item) => [item.name, item.path])),
    output,
    tmpDir,
    publicDir,
    kitSpecifier,
    plugins: config.plugins,
    vite: config.vite,
    onBuilt(outputPath) {
      console.log(`Built ${outputPath}`);
    },
    onError(message) {
      console.error(message);
    },
  });

  if (!ok) {
    process.exitCode = 1;
  }
}
