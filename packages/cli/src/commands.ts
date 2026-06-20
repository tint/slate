import { cac } from "cac";
import { runBuild } from "./commands/build.ts";
import { runCheck } from "./commands/check.ts";
import { runDev } from "./commands/dev.ts";
import { runInitCommand } from "./commands/init.ts";
import { runPreview } from "./commands/preview.ts";
import { readCliPackageJson, resolveCliVersion } from "./package-info.ts";

/**
 * Run the Slate CLI dispatcher.
 *
 * Programmatic consumers should import from `@slate/cli` and call `runInit`,
 * `runBuild`, `runDev`, `runPreview`, or `runCheck` directly.
 */
export async function run(argv: string[] = process.argv.slice(2)): Promise<void> {
  let task: (() => Promise<void>) | undefined;
  const packageJson = await readCliPackageJson();
  const cli = cac("slate");
  const knownCommands = new Set(["build", "check", "dev", "help", "init", "preview"]);

  cli
    .command("init <directory>", "Scaffold a minimal Slate project")
    .option("--force", "Overwrite the target directory")
    .action((directory: string, options: { force?: boolean }) => {
      task = () => runInitCommand({
        directory,
        force: options.force,
      });
    });

  cli
    .command("dev [input]", "Start the Slate development server")
    .option("--config <path>", "Path to slate.config.*")
    .option("--port <port>", "Dev server port")
    .option("--host <host>", "Dev server host")
    .option("--publicDir <path>", "Public assets directory")
    .option("--reload", "Enable browser reload")
    .option("--no-reload", "Disable browser reload")
    .option("--kit <specifier>", "Runtime kit import specifier")
    .action((input: string | undefined, options: {
      config?: string;
      port?: number | string;
      host?: string;
      publicDir?: string;
      reload?: boolean;
      kit?: string;
    }) => {
      task = () => runDev({
        input,
        ...options,
      });
    });

  cli
    .command("build [input]", "Build Slate input to static HTML")
    .option("--config <path>", "Path to slate.config.*")
    .option("--output <path>", "Output HTML file or directory")
    .option("--out <path>", "Alias for --output")
    .option("--tmpDir <path>", "Temporary build directory")
    .option("--publicDir <path>", "Public assets directory")
    .option("--kit <specifier>", "Runtime kit import specifier")
    .action((input: string | undefined, options: {
      config?: string;
      output?: string;
      out?: string;
      tmpDir?: string;
      publicDir?: string;
      kit?: string;
    }) => {
      task = () => runBuild({
        input,
        ...options,
      });
    });

  cli
    .command("preview", "Serve built Slate output")
    .option("--config <path>", "Path to slate.config.*")
    .option("--dir <path>", "Built output directory")
    .option("--port <port>", "Preview server port")
    .option("--host <host>", "Preview server host")
    .action((options: {
      config?: string;
      dir?: string;
      port?: number | string;
      host?: string;
    }) => {
      task = () => runPreview(options);
    });

  cli
    .command("check [input]", "Check Slate input")
    .option("--config <path>", "Path to slate.config.*")
    .action((input: string | undefined, options: { config?: string }) => {
      task = () => runCheck({
        input,
        ...options,
      });
    });

  cli
    .command("help", "Show help")
    .action(() => {
      task = async () => {
        cli.outputHelp();
      };
    });

  cli.help();
  cli.version(resolveCliVersion(packageJson));

  try {
    if (!argv.length) {
      cli.outputHelp();
      return;
    }

    const command = argv[0] ?? "";

    if (!command.startsWith("-") && !knownCommands.has(command)) {
      throw new Error(`Unknown command: ${command}`);
    }

    cli.parse(["node", "slate", ...argv]);
    await task?.();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    cli.outputHelp();
    process.exitCode = 1;
  }
}
