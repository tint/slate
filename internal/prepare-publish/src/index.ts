#!/usr/bin/env node

import { run } from "./cli";

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
