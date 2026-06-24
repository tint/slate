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

export function injectViteClient(html: string, preserveScroll = true): string {
  const viteClient = "<script type=\"module\" src=\"/@vite/client\"></script>";
  const scrollClient = preserveScroll ? slateScrollClientScript() : "";
  const script = [
    html.includes(viteClient) ? "" : viteClient,
    scrollClient && html.includes("data-slate-dev-client") ? "" : scrollClient,
  ].filter(Boolean).join("");

  if (!script) {
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
  return html
    .replace(/<script data-slate-dev-client>[\s\S]*?<\/script>\n?/g, "")
    .replace(/<script type="module" src="\/@vite\/client"><\/script>\n?/g, "");
}

function slateScrollClientScript(): string {
  return `<script data-slate-dev-client>${String.raw`
(() => {
  const key = "__slate_scroll:" + location.pathname + location.search;
  const marker = "data-slate-dev-scroll";
  const saved = read();

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  function read() {
    try {
      const raw = sessionStorage.getItem(key);
      sessionStorage.removeItem(key);
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  }

  function save() {
    const scrollingElement = document.scrollingElement || document.documentElement;
    const elements = [];

    for (const element of document.querySelectorAll("[" + marker + "]")) {
      const id = element.getAttribute(marker);

      if (id) {
        elements.push({
          id,
          left: element.scrollLeft,
          top: element.scrollTop,
        });
      }
    }

    try {
      sessionStorage.setItem(key, JSON.stringify({
        window: {
          left: window.scrollX,
          top: window.scrollY,
        },
        document: scrollingElement ? {
          left: scrollingElement.scrollLeft,
          top: scrollingElement.scrollTop,
        } : undefined,
        elements,
      }));
    } catch {
    }
  }

  function findScrollElement(id) {
    for (const element of document.querySelectorAll("[" + marker + "]")) {
      if (element.getAttribute(marker) === id) {
        return element;
      }
    }
  }

  function restore() {
    if (!saved) {
      return;
    }

    const scrollingElement = document.scrollingElement || document.documentElement;

    if (saved.document && scrollingElement) {
      scrollingElement.scrollLeft = saved.document.left || 0;
      scrollingElement.scrollTop = saved.document.top || 0;
    }

    if (saved.window) {
      window.scrollTo(saved.window.left || 0, saved.window.top || 0);
    }

    for (const item of saved.elements || []) {
      const element = findScrollElement(item.id);

      if (element) {
        element.scrollLeft = item.left || 0;
        element.scrollTop = item.top || 0;
      }
    }
  }

  addEventListener("beforeunload", save, { capture: true });
  addEventListener("pagehide", save, { capture: true });
  requestAnimationFrame(() => requestAnimationFrame(restore));
  setTimeout(restore, 80);
})();
`}</script>`;
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
