import { pathToFileURL } from "node:url";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import { access } from "node:fs/promises";
//#region src/config.ts
const DEFAULT_CONFIG = {
	plugins: [],
	dev: {
		host: "127.0.0.1",
		port: 5173,
		tmpDir: "node_modules/.slate-dev",
		reload: true
	},
	build: { tmpDir: "node_modules/.slate-tmp" },
	preview: {
		host: "127.0.0.1",
		port: 4173
	},
	kit: { specifier: "@slate/kit" }
};
/** Type helper for `slate.config.ts`. */
function defineConfig(config) {
	return config;
}
/** Load Slate config, applying CLI config selection and config-relative paths. */
async function loadConfig(configFile) {
	const configPath = await findConfig(configFile);
	const userConfig = configPath ? await importConfig(configPath) : {};
	const baseDir = configPath ? dirname(configPath) : process.cwd();
	return {
		configPath,
		input: resolveInput(baseDir, userConfig.input),
		plugins: userConfig.plugins ?? [],
		vite: userConfig.vite,
		publicDir: userConfig.publicDir ? resolveConfigPath(baseDir, userConfig.publicDir) : void 0,
		dev: {
			host: userConfig.dev?.host ?? DEFAULT_CONFIG.dev.host,
			port: userConfig.dev?.port ?? DEFAULT_CONFIG.dev.port,
			tmpDir: userConfig.dev?.tmpDir ? resolveConfigPath(baseDir, userConfig.dev.tmpDir) : DEFAULT_CONFIG.dev.tmpDir,
			reload: userConfig.dev?.reload ?? DEFAULT_CONFIG.dev.reload
		},
		build: {
			output: userConfig.build?.output ? resolveConfigPath(baseDir, userConfig.build.output) : DEFAULT_CONFIG.build.output,
			tmpDir: userConfig.build?.tmpDir ? resolveConfigPath(baseDir, userConfig.build.tmpDir) : DEFAULT_CONFIG.build.tmpDir
		},
		preview: {
			host: userConfig.preview?.host ?? DEFAULT_CONFIG.preview.host,
			port: userConfig.preview?.port ?? DEFAULT_CONFIG.preview.port
		},
		kit: { specifier: userConfig.kit?.specifier ?? DEFAULT_CONFIG.kit.specifier }
	};
}
function resolveInput(baseDir, input) {
	if (!input) return [];
	if (typeof input === "string") return [{
		name: "index",
		path: resolveConfigPath(baseDir, input)
	}];
	return Object.entries(input).map(([name, path]) => ({
		name,
		path: resolveConfigPath(baseDir, path)
	}));
}
function resolveConfigPath(baseDir, value) {
	return isAbsolute(value) ? value : resolve(baseDir, value);
}
async function findConfig(configFile) {
	if (configFile) return resolve(configFile);
	for (const name of [
		"slate.config.ts",
		"slate.config.mjs",
		"slate.config.js"
	]) {
		const candidate = resolve(name);
		if (await exists(candidate)) return candidate;
	}
}
async function importConfig(configPath) {
	const mod = await importConfigModule(configPath);
	const config = mod.default ?? mod.config ?? {};
	if (!isObject(config)) throw new Error(`Slate config must export an object: ${configPath}`);
	return config;
}
async function importConfigModule(configPath) {
	const url = pathToFileURL(configPath).href;
	const extension = extname(configPath);
	if (extension === ".ts" || extension === ".tsx" || extension === ".mts" || extension === ".cts") {
		if (isBunRuntime()) return await import(url);
		const { tsImport } = await import("tsx/esm/api");
		return await tsImport(url, import.meta.url);
	}
	return await import(`${url}?t=${Date.now()}`);
}
async function exists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}
function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isBunRuntime() {
	return typeof process.versions.bun === "string";
}
//#endregion
export { loadConfig as n, defineConfig as t };
