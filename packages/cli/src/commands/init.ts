import { resolve } from "node:path";
import { runInit } from "../scaffold";

export type InitCommandOptions = {
  directory?: string;
  force?: boolean;
};

export async function runInitCommand(options: InitCommandOptions): Promise<void> {
  const targetArg = options.directory;

  if (!targetArg) {
    throw new Error("Missing target directory. Usage: slate init <directory> [--force]");
  }

  await runInit(targetArg, {
    force: options.force,
  });

  console.log(`Created Slate project at ${resolve(targetArg)}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${targetArg}`);
  console.log("  npm install");
  console.log("  npm run dev");
  console.log("  npm run check");
  console.log("  npm run build");
  console.log("  npm run preview");
}
