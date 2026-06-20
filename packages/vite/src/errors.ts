export function sendHtml(response: import("node:http").ServerResponse, status: number, html: string, headOnly: boolean): void {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
  });

  if (headOnly) {
    response.end();
    return;
  }

  response.end(html);
}

export function injectViteClient(html: string): string {
  const script = "<script type=\"module\" src=\"/@vite/client\"></script>";

  if (html.includes(script)) {
    return html;
  }

  if (html.includes("</head>")) {
    return html.replace("</head>", `${script}</head>`);
  }

  if (html.includes("</body>")) {
    return html.replace("</body>", `${script}</body>`);
  }

  return `${script}${html}`;
}

export function stripViteClient(html: string): string {
  return html.replace(/<script type="module" src="\/@vite\/client"><\/script>\n?/g, "");
}

export function errorPage(message: string): string {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    "<title>Slate Vite Error</title>",
    "<style>body{margin:0;background:#111;color:#f5f5f5;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}main{max-width:960px;margin:48px auto;padding:0 24px}h1{font-size:20px;color:#ff6b6b}pre{white-space:pre-wrap;background:#1b1b1b;border:1px solid #333;border-radius:10px;padding:18px;overflow:auto}</style>",
    "</head>",
    "<body>",
    "<main>",
    "<h1>Slate Vite Error</h1>",
    `<pre>${escapeHtml(message)}</pre>`,
    "</main>",
    "</body>",
    "</html>",
  ].join("");
}

export function previewErrorPage(title: string, message: string): string {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `<title>${escapeHtml(title)}</title>`,
    "<style>",
    "body{margin:0;background:#111;color:#f5f5f5;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}",
    "main{max-width:960px;margin:48px auto;padding:0 24px}",
    "h1{font-size:20px;margin:0 0 16px;color:#ff6b6b}",
    "pre{white-space:pre-wrap;background:#1b1b1b;border:1px solid #333;border-radius:10px;padding:18px;overflow:auto}",
    "</style>",
    "</head>",
    "<body>",
    "<main>",
    `<h1>${escapeHtml(title)}</h1>`,
    `<pre>${escapeHtml(message)}</pre>`,
    "</main>",
    "</body>",
    "</html>",
  ].join("");
}

export function isSlateRenderError(error: unknown): error is {
  message: string;
  filename: string;
  range: {
    start: number;
    end: number;
  };
} {
  if (!(error instanceof Error) || error.name !== "SlateRenderError") {
    return false;
  }

  const candidate = error as Error & {
    filename?: unknown;
    range?: {
      start?: unknown;
      end?: unknown;
    };
  };

  return typeof candidate.filename === "string"
    && typeof candidate.range?.start === "number"
    && typeof candidate.range.end === "number";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}
