import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PreparePlan } from "./types";

export async function stagePlans(plans: PreparePlan[], options: { clean: boolean; dryRun: boolean; outDir: string }): Promise<void> {
  if (options.dryRun) {
    return;
  }

  if (options.clean) {
    await rm(options.outDir, {
      recursive: true,
      force: true,
    });
  }

  for (const plan of plans) {
    if (plan.errors.length > 0) {
      continue;
    }

    await rm(plan.stagingDir, {
      recursive: true,
      force: true,
    });
    await mkdir(plan.stagingDir, {
      recursive: true,
    });

    for (const file of plan.files) {
      if (file === "package.json") {
        continue;
      }

      const source = path.join(plan.pkg.dir, file);
      const target = path.join(plan.stagingDir, file);
      await mkdir(path.dirname(target), {
        recursive: true,
      });
      await cp(source, target, {
        recursive: true,
        force: true,
      });
    }

    await writeFile(
      path.join(plan.stagingDir, "package.json"),
      `${JSON.stringify(plan.rewrittenPackageJson, null, 2)}\n`,
      "utf8",
    );
  }
}

export async function readStagedPackageJson(stagingDir: string): Promise<string> {
  return readFile(path.join(stagingDir, "package.json"), "utf8");
}
