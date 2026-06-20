import { n as loadConfig } from "./config-CgeRExtq.mjs";
import { fileURLToPath } from "node:url";
import { cac } from "cac";
import { basename, dirname, parse, resolve } from "node:path";
import { buildSlate, createSlateDevServer, createSlatePreviewServer } from "@slate/vite";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { formatDiagnostic } from "@slate/compiler";
import { checkFiles } from "@slate/check";
import { homedir } from "node:os";
//#region src/args.ts
function resolveInputs(input, configured) {
	if (input) return [{
		name: "index",
		path: resolve(input)
	}];
	return configured;
}
function previewDirFromConfig(output, input) {
	if (!output) return input.length > 1 ? "dist" : "dist";
	return input.length > 1 ? output : dirname(output);
}
//#endregion
//#region src/commands/build.ts
async function runBuild(options = {}) {
	const config = await loadConfig(options.config);
	const input = resolveInputs(options.input, config.input);
	const output = options.output ?? options.out ?? config.build.output ?? (input.length > 1 ? "dist" : "dist/index.html");
	const tmpDir = resolve(options.tmpDir ?? config.build.tmpDir);
	const kitSpecifier = options.kit ?? config.kit.specifier;
	const publicDir = options.publicDir ?? config.publicDir;
	if (!input.length) throw new Error("Missing input file. Usage: slate build [input.slate] [--output dist/index.html]");
	if (!await buildSlate({
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
		}
	})) process.exitCode = 1;
}
//#endregion
//#region src/commands/check.ts
async function runCheck(options = {}) {
	const config = await loadConfig(options.config);
	const input = resolveInputs(options.input, config.input);
	if (!input.length) throw new Error("Missing input file. Usage: slate check <input.slate>");
	let hasDiagnostics = false;
	for (const item of input) {
		const result = await checkFiles({ entry: item.path });
		if (!result.diagnostics.length) continue;
		hasDiagnostics = true;
		for (const diagnostic of result.diagnostics) console.error(formatDiagnostic(diagnostic, diagnostic.filename ? result.sources[diagnostic.filename] : void 0));
	}
	if (hasDiagnostics) {
		process.exitCode = 1;
		return;
	}
	console.log("No issues found.");
}
//#endregion
//#region src/commands/dev.ts
async function runDev(options = {}) {
	const config = await loadConfig(options.config);
	const input = resolveInputs(options.input, config.input);
	const port = Number(options.port ?? process.env.PORT ?? config.dev.port);
	const host = options.host ?? config.dev.host;
	const publicDir = options.publicDir ?? config.publicDir;
	const reload = options.reload ?? config.dev.reload;
	const kitSpecifier = options.kit ?? config.kit.specifier;
	if (!input.length) throw new Error("Missing input file. Usage: slate dev <input.slate> [--port 5173]");
	if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid port: ${String(port)}`);
	const server = await createSlateDevServer({
		root: process.cwd(),
		input: Object.fromEntries(input.map((item) => [item.name, item.path])),
		publicDir: publicDir ? resolve(publicDir) : void 0,
		reload,
		kitSpecifier,
		plugins: config.plugins,
		vite: config.vite,
		server: {
			host,
			port
		}
	});
	await server.listen();
	const address = server.httpServer?.address();
	if (address && typeof address !== "string") console.log(`Slate dev server running at http://${address.address}:${address.port}/`);
}
//#endregion
//#region src/package-info.ts
let cachedPackageJson;
async function readCliPackageJson() {
	if (cachedPackageJson) return cachedPackageJson;
	const packageJsonUrl = new URL("../package.json", import.meta.url);
	try {
		cachedPackageJson = JSON.parse(await readFile(packageJsonUrl, "utf8"));
	} catch {
		const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), "../package.json");
		cachedPackageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
	}
	return cachedPackageJson;
}
function resolveCliVersion(packageJson) {
	return packageJson.version ?? "0.0.0";
}
//#endregion
//#region src/scaffold.ts
/** Scaffold a minimal Slate project. */
async function runInit(targetArg, options = {}) {
	const targetDir = resolve(targetArg);
	assertSafeTargetDir(targetDir);
	await createProject(targetDir, { force: options.force ?? false });
}
async function createProject(targetDir, options) {
	await mkdir(targetDir, { recursive: true });
	if ((await readdir(targetDir)).length > 0) {
		if (!options.force) throw new Error(`Target directory is not empty: ${targetDir}. Use --force to overwrite scaffold files.`);
		await rm(targetDir, {
			recursive: true,
			force: true
		});
		await mkdir(targetDir, { recursive: true });
	}
	const projectName = normalizePackageName(basename(targetDir) || "slate-app");
	const packageJson = await readCliPackageJson();
	await writeFile(`${targetDir}/package.json`, `${JSON.stringify(createPackageJson(projectName, packageJson), null, 2)}\n`, "utf8");
	await writeFile(`${targetDir}/README.md`, createReadme(projectName), "utf8");
	await writeFile(`${targetDir}/slate.config.ts`, createSlateConfig(), "utf8");
	await writeFile(`${targetDir}/.gitignore`, "node_modules\ndist\n.slate-tmp\n.slate-dev\n", "utf8");
	await mkdir(`${targetDir}/src`, { recursive: true });
	await mkdir(`${targetDir}/src/components`, { recursive: true });
	await mkdir(`${targetDir}/public`, { recursive: true });
	await writeFile(`${targetDir}/src/App.slate`, createAppSlate(), "utf8");
	await writeFile(`${targetDir}/src/components/Card.slate`, createCardSlate(), "utf8");
	await writeFile(`${targetDir}/public/favicon.svg`, createFavicon(), "utf8");
}
function createPackageJson(projectName, packageJson) {
	const cliRange = toJsrAliasRange("cli", resolveCliVersion(packageJson));
	return {
		name: projectName,
		private: true,
		type: "module",
		scripts: {
			dev: "slate dev",
			check: "slate check",
			build: "slate build",
			preview: "slate preview"
		},
		dependencies: { "@slate/kit": toJsrAliasRange("kit", packageJson.dependencies?.["@slate/kit"]) },
		devDependencies: { "@slate/cli": cliRange }
	};
}
function toJsrAliasRange(packageName, range) {
	return `npm:@jsr/slate__${packageName}@${range ?? "latest"}`;
}
function createReadme(projectName) {
	return `# ${projectName}

Minimal Slate project.

This project uses JSR packages through npm aliases while source code imports remain \`@slate/*\`.

## Install

\`\`\`sh
npm install
\`\`\`

Other package managers that support npm aliases can also be used.

## Commands

\`\`\`sh
npm run dev
npm run check
npm run build
npm run preview
\`\`\`
`;
}
function createSlateConfig() {
	return `import { defineConfig } from "@slate/cli";

export default defineConfig({
  input: "src/App.slate",
  publicDir: "public",
  dev: {
    host: "127.0.0.1",
    port: 5173,
    reload: true,
  },
  build: {
    output: "dist/index.html",
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});
`;
}
function createFavicon() {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#111111" />
  <path d="M9 9h14v4H13v4h8v4H9z" fill="#ffffff" />
</svg>
`;
}
function createAppSlate() {
	return `<script slate>
import Card from "./components/Card.slate";

const title = "Slate";
const items = ["syntax", "diagnostics", "components"];
<\/script>

<main>
  <h1>{title}</h1>

  <Card title="Ready">
    <ul>
      {#each items as item}
        <li>{item}</li>
      {/each}
    </ul>
  </Card>
</main>
`;
}
function createCardSlate() {
	return `<script slate>
const title = $prop("title", "Card");
<\/script>

<section class="card">
  <h2>{title}</h2>
  <slot />
</section>
`;
}
function normalizePackageName(value) {
	return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "slate-app";
}
function assertSafeTargetDir(targetDir) {
	const parsed = parse(targetDir);
	if ((/* @__PURE__ */ new Set([
		parsed.root,
		resolve(homedir()),
		process.cwd()
	])).has(targetDir)) throw new Error(`Refusing to scaffold into unsafe target directory: ${targetDir}`);
}
//#endregion
//#region src/commands/init.ts
async function runInitCommand(options) {
	const targetArg = options.directory;
	if (!targetArg) throw new Error("Missing target directory. Usage: slate init <directory> [--force]");
	await runInit(targetArg, { force: options.force });
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
//#endregion
//#region src/commands/preview.ts
async function runPreview(options = {}) {
	const config = await loadConfig(options.config);
	const port = Number(options.port ?? process.env.PORT ?? config.preview.port);
	const host = options.host ?? config.preview.host;
	const dir = resolve(options.dir ?? previewDirFromConfig(config.build.output, config.input));
	if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid port: ${String(port)}`);
	const server = createSlatePreviewServer({
		root: process.cwd(),
		dir
	});
	server.listen(port, host, () => {
		const address = server.address();
		console.log(`Slate preview server running at http://${address.address}:${address.port}/`);
	});
}
//#endregion
//#region src/commands.ts
/**
* Run the Slate CLI dispatcher.
*
* Programmatic consumers should import from `@slate/cli` and call `runInit`,
* `runBuild`, `runDev`, `runPreview`, or `runCheck` directly.
*/
async function run(argv = process.argv.slice(2)) {
	let task;
	const packageJson = await readCliPackageJson();
	const cli = cac("slate");
	const knownCommands = /* @__PURE__ */ new Set([
		"build",
		"check",
		"dev",
		"help",
		"init",
		"preview"
	]);
	cli.command("init <directory>", "Scaffold a minimal Slate project").option("--force", "Overwrite the target directory").action((directory, options) => {
		task = () => runInitCommand({
			directory,
			force: options.force
		});
	});
	cli.command("dev [input]", "Start the Slate development server").option("--config <path>", "Path to slate.config.*").option("--port <port>", "Dev server port").option("--host <host>", "Dev server host").option("--tmpDir <path>", "Temporary build directory").option("--publicDir <path>", "Public assets directory").option("--reload", "Enable browser reload").option("--no-reload", "Disable browser reload").option("--kit <specifier>", "Runtime kit import specifier").action((input, options) => {
		task = () => runDev({
			input,
			...options
		});
	});
	cli.command("build [input]", "Build Slate input to static HTML").option("--config <path>", "Path to slate.config.*").option("--output <path>", "Output HTML file or directory").option("--out <path>", "Alias for --output").option("--tmpDir <path>", "Temporary build directory").option("--publicDir <path>", "Public assets directory").option("--kit <specifier>", "Runtime kit import specifier").action((input, options) => {
		task = () => runBuild({
			input,
			...options
		});
	});
	cli.command("preview", "Serve built Slate output").option("--config <path>", "Path to slate.config.*").option("--dir <path>", "Built output directory").option("--port <port>", "Preview server port").option("--host <host>", "Preview server host").action((options) => {
		task = () => runPreview(options);
	});
	cli.command("check [input]", "Check Slate input").option("--config <path>", "Path to slate.config.*").action((input, options) => {
		task = () => runCheck({
			input,
			...options
		});
	});
	cli.command("help", "Show help").action(() => {
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
		if (!command.startsWith("-") && !knownCommands.has(command)) throw new Error(`Unknown command: ${command}`);
		cli.parse([
			"node",
			"slate",
			...argv
		]);
		await task?.();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		cli.outputHelp();
		process.exitCode = 1;
	}
}
//#endregion
export { runCheck as a, runDev as i, runPreview as n, runBuild as o, runInit as r, run as t };
