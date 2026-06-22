import { get } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, rm } from "node:fs/promises";
import type { Plugin } from "vite";
import { buildSlate, createSlateDevServer, slate } from "../src/index";

const root = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(root, "..");
const fixtureRoot = join(packageRoot, "fixtures/basic");
const appPath = join(fixtureRoot, "App.slate");
const tmpDir = join(packageRoot, ".tmp");

await rm(tmpDir, {
  recursive: true,
  force: true,
});

const slatePlugin = slate({
  sourcemap: true,
}) as Plugin;
const transform = typeof slatePlugin.transform === "function"
  ? slatePlugin.transform
  : slatePlugin.transform?.handler;
const transformed = await transform?.call({
  error(error: string | Error): never {
    throw typeof error === "string" ? new Error(error) : error;
  },
} as never, "", appPath);

if (
  !transformed ||
  typeof transformed === "string" ||
  !("map" in transformed) ||
  !transformed.map ||
  !JSON.stringify(transformed.map).includes("App.slate")
) {
  throw new Error("Expected Slate Vite transform to return a source map for .slate input.");
}

const server = await createSlateDevServer({
  root: fixtureRoot,
  input: "App.slate",
  publicDir: fixtureRoot,
  vite: {
    define: {
      __SLATE_VITE_FIXTURE__: JSON.stringify("configured by vite"),
    },
    build: {
      sourcemap: true,
    },
  },
  server: {
    host: "127.0.0.1",
    port: 0,
  },
});

try {
  await server.listen();
  const address = server.httpServer?.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected Vite dev server to listen on a TCP address.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const page = await getText(`${baseUrl}/`);
  const favicon = await getText(`${baseUrl}/favicon.svg`);

  if (
    page.statusCode !== 200 ||
    !page.body.includes("Slate Vite") ||
    !page.body.includes("configured by vite") ||
    !page.body.includes("alt=\"Slate logo\"") ||
    !page.body.includes("/@vite/client") ||
    !page.body.includes("data-slate-dev-client") ||
    !page.body.includes("data-slate-dev-scroll=\"main\"") ||
    !page.body.includes("<link rel=\"stylesheet\" href=\"/style.css\">") ||
    !appearsBefore(page.body, "<style>\n  body {\n    margin: 0;\n  }\n</style>", "</head>") ||
    !appearsBefore(page.body, "<script>\n  globalThis.__SLATE_HEAD__ = true;\n</script>", "</head>") ||
    !appearsBefore(page.body, "<script>\n  globalThis.__SLATE_TAIL__ = true;\n</script>", "</body>")
  ) {
    throw new Error(`Unexpected Slate Vite page response.\nStatus: ${page.statusCode}\nBody:\n${page.body}`);
  }

  if (favicon.statusCode !== 200 || !favicon.body.includes("<svg")) {
    throw new Error(`Unexpected Slate Vite public response.\nStatus: ${favicon.statusCode}\nBody:\n${favicon.body}`);
  }
} finally {
  await server.close();
}

const built: string[] = [];
const ok = await buildSlate({
  root: fixtureRoot,
  input: "App.slate",
  publicDir: fixtureRoot,
  output: join(tmpDir, "index.html"),
  tmpDir: join(tmpDir, "modules"),
  vite: {
    define: {
      __SLATE_VITE_FIXTURE__: JSON.stringify("configured by vite"),
    },
  },
  onBuilt(outputPath) {
    built.push(outputPath);
  },
});

if (!ok) {
  throw new Error("Expected buildSlate to complete successfully.");
}

const html = await readFile(join(tmpDir, "index.html"), "utf8");
const favicon = await readFile(join(tmpDir, "favicon.svg"), "utf8");
const logo = await readFile(join(tmpDir, "logo.svg"), "utf8");

if (
  !html.includes("Slate Vite") ||
  !html.includes("configured by vite") ||
  !html.includes("alt=\"Slate logo\"") ||
  html.includes("data-slate-dev-scroll") ||
  !html.includes("<link rel=\"stylesheet\" href=\"assets/") ||
  !appearsBefore(html, "<style>\n  body {\n    margin: 0;\n  }\n</style>", "</head>") ||
  !appearsBefore(html, "<script>\n  globalThis.__SLATE_HEAD__ = true;\n</script>", "</head>") ||
  !appearsBefore(html, "<script>\n  globalThis.__SLATE_TAIL__ = true;\n</script>", "</body>") ||
  built.length !== 1
) {
  throw new Error(`Unexpected buildSlate HTML output.\n${html}`);
}

function appearsBefore(source: string, needle: string, marker: string): boolean {
  const needleIndex = source.indexOf(needle);
  const markerIndex = source.indexOf(marker);

  return needleIndex !== -1 && markerIndex !== -1 && needleIndex < markerIndex;
}

if (!favicon.includes("<svg")) {
  throw new Error(`Unexpected buildSlate public output.\n${favicon}`);
}

if (!logo.includes("<svg")) {
  throw new Error(`Unexpected buildSlate imported asset output.\n${logo}`);
}

const minifiedOk = await buildSlate({
  root: fixtureRoot,
  input: "App.slate",
  output: join(tmpDir, "minified.html"),
  tmpDir: join(tmpDir, "minified-modules"),
  html: {
    format: "minify",
  },
  vite: {
    define: {
      __SLATE_VITE_FIXTURE__: JSON.stringify("configured by vite"),
    },
  },
});

if (!minifiedOk) {
  throw new Error("Expected minified buildSlate to complete successfully.");
}

const minifiedHtml = await readFile(join(tmpDir, "minified.html"), "utf8");

// Exercise the direct @slate/vite API path for html.format. CLI coverage lives
// in packages/cli so both public entry points are protected.
if (
  !minifiedHtml.includes("Slate Vite") ||
  !minifiedHtml.includes("configured by vite") ||
  minifiedHtml.includes("\n  <")
) {
  throw new Error(`Unexpected minified buildSlate HTML output.\n${minifiedHtml}`);
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
