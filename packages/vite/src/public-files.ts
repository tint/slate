import { constants } from "node:fs";
import { access, cp, mkdir, readFile, stat } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

/** Copy a public directory into the build output, ignoring missing directories. */
export async function copyPublicDir(publicDir: string, outputDir: string): Promise<void> {
  try {
    await mkdir(outputDir, {
      recursive: true,
    });
    await cp(publicDir, outputDir, {
      recursive: true,
      force: true,
    });
  } catch (error) {
    if (isNotFoundError(error)) {
      return;
    }

    throw error;
  }
}

/** Serve preview files with HTML-friendly route fallbacks and path traversal protection. */
export async function servePreviewFile(rootDir: string, pathname: string): Promise<{
  status: number;
  headers: Record<string, string>;
  body: Buffer;
} | undefined> {
  for (const candidate of previewPathCandidates(pathname)) {
    const result = await servePublicFile(rootDir, candidate);

    if (result) {
      return result;
    }
  }

  return undefined;
}

async function servePublicFile(publicDir: string, pathname: string): Promise<{
  status: number;
  headers: Record<string, string>;
  body: Buffer;
} | undefined> {
  if (!await pathExists(publicDir)) {
    return undefined;
  }

  const filePath = resolvePublicPath(publicDir, pathname);

  if (!filePath) {
    return undefined;
  }

  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      return undefined;
    }

    return {
      status: 200,
      headers: {
        "content-type": contentTypeFor(filePath),
      },
      body: await readFile(filePath),
    };
  } catch {
    return undefined;
  }
}

function previewPathCandidates(pathname: string): string[] {
  if (pathname === "/") {
    return ["/index.html"];
  }

  if (extname(pathname)) {
    return [pathname];
  }

  return [`${pathname}.html`, `${pathname}/index.html`];
}

function resolvePublicPath(publicDir: string, pathname: string): string | undefined {
  const normalizedPath = pathname.replace(/^\/+/, "");
  const filePath = resolve(publicDir, normalizedPath);
  const relativePath = relative(publicDir, filePath);

  if (relativePath.startsWith("..") || relativePath === "" || relativePath.includes(`..${sep}`)) {
    return undefined;
  }

  return filePath;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function contentTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "ENOENT";
}
