import { formatDiagnostic } from "@slate/compiler";
import { checkFiles } from "@slate/check";
import { resolveInputs } from "../args";
import { loadConfig } from "../config";

export type CheckOptions = {
  input?: string;
  config?: string;
};

export async function runCheck(options: CheckOptions = {}): Promise<void> {
  const config = await loadConfig(options.config);
  const input = resolveInputs(options.input, config.input);

  if (!input.length) {
    throw new Error("Missing input file. Usage: slate check <input.slate>");
  }

  let hasDiagnostics = false;

  for (const item of input) {
    const result = await checkFiles({
      entry: item.path,
    });

    if (!result.diagnostics.length) {
      continue;
    }

    hasDiagnostics = true;

    for (const diagnostic of result.diagnostics) {
      console.error(formatDiagnostic(diagnostic, diagnostic.filename ? result.sources[diagnostic.filename] : undefined));
    }
  }

  if (hasDiagnostics) {
    process.exitCode = 1;
    return;
  }

  console.log("No issues found.");
}
