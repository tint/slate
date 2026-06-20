import { mkdir, readFile, rm } from "node:fs/promises";
import { get } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { runBuild, runCheck } from "../src/index";

const root = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(root, "..");
const tmpDir = join(packageRoot, ".tmp");
const cliPath = join(packageRoot, "src/index.ts");

await rm(tmpDir, {
  recursive: true,
  force: true,
});
await mkdir(tmpDir, {
  recursive: true,
});

await runCli(["check", join(packageRoot, "fixtures/basic.slate")], 0);
await assertCheckError();
await assertBuild("basic", join(packageRoot, "fixtures/basic.slate"));
await assertBuild("component", join(packageRoot, "fixtures/component/index.slate"));
await assertRuntimeError();
await assertDev();
await assertConfig();
await assertProgrammaticApi();

async function assertBuild(name: string, input: string): Promise<void> {
  const output = join(tmpDir, `${name}.html`);
  await runCli(["build", input, "--out", output, "--tmpDir", join(tmpDir, `${name}-modules`)], 0);

  const actual = await readFile(output, "utf8");
  const expected = await readFile(join(packageRoot, "fixtures", `${name}.expected.html`), "utf8");

  if (actual.trimEnd() !== expected.trimEnd()) {
    throw new Error(`Unexpected ${name} build output.\nExpected:\n${expected}\nActual:\n${actual}`);
  }
}

async function assertRuntimeError(): Promise<void> {
  const output = join(tmpDir, "runtime-error.html");
  const input = join(packageRoot, "fixtures/runtime-error.slate");
  const result = await runCli(["build", input, "--out", output, "--tmpDir", join(tmpDir, "runtime-error-modules")], 1);
  const expectedLocation = `${input}:5:5: error:`;

  if (
    !result.stderr.includes(expectedLocation)
    || !result.stderr.includes("<p>{user.name}</p>")
    || !result.stderr.includes("    ^^^^^^^^^")
  ) {
    throw new Error(`Unexpected runtime error output.\nExpected location: ${expectedLocation}\nActual:\n${result.stderr}`);
  }
}

async function assertCheckError(): Promise<void> {
  const input = join(packageRoot, "fixtures/error.slate");
  const result = await runCli(["check", input], 1);
  const expectedLocation = `${input}:2:3: error:`;

  if (
    !result.stderr.includes(expectedLocation)
    || !result.stderr.includes("export const invalid = true;")
    || !result.stderr.includes("  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^")
  ) {
    throw new Error(`Unexpected check error output.\nExpected location: ${expectedLocation}\nActual:\n${result.stderr}`);
  }
}

async function assertDev(): Promise<void> {
  const input = join(packageRoot, "fixtures/basic.slate");
  const expected = await readFile(join(packageRoot, "fixtures/basic.expected.html"), "utf8");
  const child = spawn("bun", [cliPath, "dev", input, "--port", "0", "--tmpDir", join(tmpDir, "dev-modules"), "--no-reload"], {
    cwd: packageRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";

  try {
    const url = await waitForDevUrl(child, (chunk) => {
      stdout += chunk;
    }, (chunk) => {
      stderr += chunk;
    }, () => stdout, () => stderr);
    const response = await getText(url);

    if (response.statusCode !== 200 || response.body.trimEnd() !== expected.trimEnd()) {
      throw new Error(`Unexpected dev response.\nStatus: ${response.statusCode}\nExpected:\n${expected}\nActual:\n${response.body}`);
    }
  } finally {
    child.kill();
  }
}

async function assertConfig(): Promise<void> {
  const configPath = join(packageRoot, "fixtures/slate.config.ts");
  const expectedIndex = await readFile(join(packageRoot, "fixtures/basic.expected.html"), "utf8");
  const expectedComponent = await readFile(join(packageRoot, "fixtures/component.expected.html"), "utf8");
  const expectedConfigured = await readFile(join(packageRoot, "fixtures/configured.expected.html"), "utf8");
  await runCli(["check", "--config", configPath], 0);
  await runCli(["build", "--config", configPath], 0);

  const builtIndex = await readFile(join(packageRoot, ".tmp/config-build/index.html"), "utf8");
  const builtComponent = await readFile(join(packageRoot, ".tmp/config-build/component.html"), "utf8");
  const builtConfigured = await readFile(join(packageRoot, ".tmp/config-build/configured.html"), "utf8");
  const builtFavicon = await readFile(join(packageRoot, ".tmp/config-build/favicon.svg"), "utf8");

  if (builtIndex.trimEnd() !== expectedIndex.trimEnd()) {
    throw new Error(`Unexpected config index build output.\nExpected:\n${expectedIndex}\nActual:\n${builtIndex}`);
  }

  if (builtComponent.trimEnd() !== expectedComponent.trimEnd()) {
    throw new Error(`Unexpected config component build output.\nExpected:\n${expectedComponent}\nActual:\n${builtComponent}`);
  }

  if (builtConfigured.trimEnd() !== expectedConfigured.trimEnd()) {
    throw new Error(`Unexpected config configured build output.\nExpected:\n${expectedConfigured}\nActual:\n${builtConfigured}`);
  }

  if (!builtFavicon.includes("<svg")) {
    throw new Error("Expected public favicon.svg to be copied during build.");
  }

  const child = spawn("bun", [cliPath, "dev", "--config", configPath], {
    cwd: packageRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";

  try {
    const url = await waitForDevUrl(child, (chunk) => {
      stdout += chunk;
    }, (chunk) => {
      stderr += chunk;
    }, () => stdout, () => stderr);
    const indexResponse = await getText(url);
    const componentResponse = await getText(`${url}component`);
    const configuredResponse = await getText(`${url}configured`);
    const faviconResponse = await getText(`${url}favicon.svg`);

    if (indexResponse.statusCode !== 200 || stripReloadScript(indexResponse.body).trimEnd() !== expectedIndex.trimEnd()) {
      throw new Error(`Unexpected config dev index response.\nStatus: ${indexResponse.statusCode}\nExpected:\n${expectedIndex}\nActual:\n${indexResponse.body}`);
    }

    if (componentResponse.statusCode !== 200 || stripReloadScript(componentResponse.body).trimEnd() !== expectedComponent.trimEnd()) {
      throw new Error(`Unexpected config dev component response.\nStatus: ${componentResponse.statusCode}\nExpected:\n${expectedComponent}\nActual:\n${componentResponse.body}`);
    }

    if (configuredResponse.statusCode !== 200 || stripReloadScript(configuredResponse.body).trimEnd() !== expectedConfigured.trimEnd()) {
      throw new Error(`Unexpected config dev configured response.\nStatus: ${configuredResponse.statusCode}\nExpected:\n${expectedConfigured}\nActual:\n${configuredResponse.body}`);
    }

    if (!indexResponse.body.includes("/@vite/client")) {
      throw new Error("Expected config dev response to include Vite client script.");
    }

    if (faviconResponse.statusCode !== 200 || !faviconResponse.body.includes("<svg")) {
      throw new Error(`Unexpected config dev public response.\nStatus: ${faviconResponse.statusCode}\nActual:\n${faviconResponse.body}`);
    }
  } finally {
    child.kill();
  }

  const preview = spawn("bun", [cliPath, "preview", "--config", configPath, "--port", "0"], {
    cwd: packageRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  stdout = "";
  stderr = "";

  try {
    const url = await waitForServerUrl(preview, "preview", (chunk) => {
      stdout += chunk;
    }, (chunk) => {
      stderr += chunk;
    }, () => stdout, () => stderr);
    const indexResponse = await getText(url);
    const componentResponse = await getText(`${url}component`);
    const configuredResponse = await getText(`${url}configured`);
    const faviconResponse = await getText(`${url}favicon.svg`);

    if (indexResponse.statusCode !== 200 || indexResponse.body.trimEnd() !== expectedIndex.trimEnd()) {
      throw new Error(`Unexpected preview index response.\nStatus: ${indexResponse.statusCode}\nExpected:\n${expectedIndex}\nActual:\n${indexResponse.body}`);
    }

    if (componentResponse.statusCode !== 200 || componentResponse.body.trimEnd() !== expectedComponent.trimEnd()) {
      throw new Error(`Unexpected preview component response.\nStatus: ${componentResponse.statusCode}\nExpected:\n${expectedComponent}\nActual:\n${componentResponse.body}`);
    }

    if (configuredResponse.statusCode !== 200 || configuredResponse.body.trimEnd() !== expectedConfigured.trimEnd()) {
      throw new Error(`Unexpected preview configured response.\nStatus: ${configuredResponse.statusCode}\nExpected:\n${expectedConfigured}\nActual:\n${configuredResponse.body}`);
    }

    if (indexResponse.body.includes("/__slate/events")) {
      throw new Error("Preview response must not include reload client script.");
    }

    if (faviconResponse.statusCode !== 200 || !faviconResponse.body.includes("<svg")) {
      throw new Error(`Unexpected preview public response.\nStatus: ${faviconResponse.statusCode}\nActual:\n${faviconResponse.body}`);
    }
  } finally {
    preview.kill();
  }
}

async function assertProgrammaticApi(): Promise<void> {
  const output = join(tmpDir, "programmatic.html");
  const previousCwd = process.cwd();

  try {
    process.chdir(packageRoot);
    await runCheck({
      input: join(packageRoot, "fixtures/basic.slate"),
    });
    await runBuild({
      input: join(packageRoot, "fixtures/basic.slate"),
      out: output,
      tmpDir: join(tmpDir, "programmatic-modules"),
    });
  } finally {
    process.chdir(previousCwd);
  }

  const html = await readFile(output, "utf8");

  if (!html.includes("<h1>Slate</h1>")) {
    throw new Error(`Unexpected programmatic build output.\n${html}`);
  }
}

function stripReloadScript(html: string): string {
  return html.replace(/<script type="module" src="\/@vite\/client"><\/script>\n?/g, "");
}

function waitForDevUrl(
  child: ReturnType<typeof spawn>,
  onStdout: (chunk: string) => void,
  onStderr: (chunk: string) => void,
  getStdout: () => string,
  getStderr: () => string,
): Promise<string> {
  return waitForServerUrl(child, "dev", onStdout, onStderr, getStdout, getStderr);
}

function waitForServerUrl(
  child: ReturnType<typeof spawn>,
  kind: "dev" | "preview",
  onStdout: (chunk: string) => void,
  onStderr: (chunk: string) => void,
  getStdout: () => string,
  getStderr: () => string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${kind} server.\nstdout:\n${getStdout()}\nstderr:\n${getStderr()}`));
    }, 5000);

    child.stdout!.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      onStdout(text);
      const match = getStdout().match(new RegExp(`Slate ${kind} server running at http://[^:\\s]+:(\\d+)/`));

      if (match) {
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${match[1]}/`);
      }
    });

    child.stderr!.on("data", (chunk: Buffer) => {
      onStderr(chunk.toString("utf8"));
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`${kind} server exited early with ${code}.\nstdout:\n${getStdout()}\nstderr:\n${getStderr()}`));
    });
  });
}

async function getText(url: string): Promise<{
  statusCode: number;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    get(url, (response) => {
      const chunks: Buffer[] = [];

      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    }).on("error", reject);
  });
}

async function runCli(args: string[], expectedExitCode: number): Promise<{
  stdout: string;
  stderr: string;
}> {
  const result = await spawnProcess("bun", [cliPath, ...args]);

  if (result.exitCode !== expectedExitCode) {
    throw new Error(
      [
        `Expected \`slate ${args.join(" ")}\` to exit with ${expectedExitCode}, got ${result.exitCode}.`,
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      );
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function spawnProcess(command: string, args: string[]): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: packageRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}
