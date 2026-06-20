import { dirname, resolve } from "node:path";
import type { ResolvedSlateInput } from "./config.ts";

export function resolveInputs(input: string | undefined, configured: ResolvedSlateInput[]): ResolvedSlateInput[] {
  if (input) {
    return [{
      name: "index",
      path: resolve(input),
    }];
  }

  return configured;
}

export function previewDirFromConfig(output: string | undefined, input: ResolvedSlateInput[]): string {
  if (!output) {
    return "dist";
  }

  return input.length > 1 ? output : dirname(output);
}
