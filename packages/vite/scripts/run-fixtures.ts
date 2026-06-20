import { get } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, rm } from "node:fs/promises";
import { buildSlate, createSlateDevServer } from "../src/index";

const root = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(root, "..");
const fixtureRoot = join(packageRoot, "fixtures/basic");
const tmpDir = join(packageRoot, ".tmp");

await rm(tmpDir, {
  recursive: true,
  force: true,
});

const server = await createSlateDevServer({
  root: fixtureRoot,
  input: "App.slate",
  publicDir: fixtureRoot,
  vite: {
    define: {
      __SLATE_VITE_FIXTURE__: JSON.stringify("configured by vite"),
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

  if (page.statusCode !== 200 || !page.body.includes("Slate Vite") || !page.body.includes("configured by vite") || !page.body.includes("alt=\"Slate logo\"") || !page.body.includes("/@vite/client")) {
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

if (!html.includes("Slate Vite") || !html.includes("configured by vite") || !html.includes("alt=\"Slate logo\"") || built.length !== 1) {
  throw new Error(`Unexpected buildSlate HTML output.\n${html}`);
}

if (!favicon.includes("<svg")) {
  throw new Error(`Unexpected buildSlate public output.\n${favicon}`);
}

if (!logo.includes("<svg")) {
  throw new Error(`Unexpected buildSlate imported asset output.\n${logo}`);
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
