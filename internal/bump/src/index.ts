#!/usr/bin/env node

import { applyBumpPlan, assertWorkspaceRootIsGitRepository, findBumpPackages, findWorkspaceRoot } from "./workspace";
import { collectBumpPlan, confirmContinue, confirmPlan, logError, logInfo, logWarn, printPlan } from "./prompts";

async function main(): Promise<void> {
  const root = await findWorkspaceRoot(process.cwd());
  await assertWorkspaceRootIsGitRepository(root);

  const packages = await findBumpPackages(root);

  if (!packages.length) {
    logWarn("No bumpable workspace packages found.");
    return;
  }

  let remaining = packages;

  while (remaining.length) {
    const plan = await collectBumpPlan(root, remaining);

    if (!plan) {
      logWarn("No package changes selected.");
      return;
    }

    printPlan(plan);

    if (!(await confirmPlan())) {
      logWarn("Bump plan cancelled.");
      return;
    }

    await applyBumpPlan(root, [plan]);
    logInfo("Bump metadata updated.");

    remaining = remaining.filter((pkg) => pkg.name !== plan.pkg.name);
    if (!remaining.length || !(await confirmContinue())) {
      return;
    }
  }
}

main().catch((error: unknown) => {
  logError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
