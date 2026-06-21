export type SlotFn<T = unknown> = (data?: T) => string | Promise<string>;

export type Slots = Record<string, SlotFn | undefined>;

export type SlateContext = {
  provides?: Record<string, unknown>;
  assets?: SlateAssets;
};

export type SlateAssets = {
  head: Map<string, string>;
  tail: Map<string, string>;
};

export type SlateSourceLocation = {
  filename: string;
  range: {
    start: number;
    end: number;
  };
  kind: "script" | "template" | "slot" | "component";
};

export class SlateRenderError extends Error {
  readonly cause: unknown;
  readonly filename: string;
  readonly range: SlateSourceLocation["range"];
  readonly kind: SlateSourceLocation["kind"];

  constructor(cause: unknown, location: SlateSourceLocation) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(message);
    this.name = "SlateRenderError";
    this.cause = cause;
    this.filename = location.filename;
    this.range = location.range;
    this.kind = location.kind;
  }
}

export function evaluateSlateExpression<T>(fn: () => T, location: SlateSourceLocation): T {
  try {
    return fn();
  } catch (cause) {
    throw new SlateRenderError(cause, location);
  }
}

export function escapeHTML(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function cloneContext(context: SlateContext = {}): SlateContext {
  return {
    ...context,
    provides: {
      ...(context.provides ?? {}),
    },
    assets: context.assets ?? createSlateAssets(),
  };
}

export function createSlateAssets(): SlateAssets {
  return {
    head: new Map<string, string>(),
    tail: new Map<string, string>(),
  };
}

export function addGlobalAsset(context: SlateContext, position: "head" | "tail", html: string): string {
  const assets = context.assets ?? (context.assets = createSlateAssets());
  const key = `${position}:${html}`;
  assets[position].set(key, html);
  return "";
}

export function injectCollectedAssets(html: string, context: SlateContext): string {
  const assets = context.assets;

  if (!assets) {
    return html;
  }

  const head = Array.from(assets.head.values());
  const tail = Array.from(assets.tail.values());
  let output = injectAssetGroup(html, head, "head");

  output = injectAssetGroup(output, tail, "tail");
  return output;
}

function injectAssetGroup(html: string, assets: string[], position: "head" | "tail"): string {
  if (!assets.length) {
    return html;
  }

  const content = assets.join("\n");

  if (position === "head") {
    return /<\/head>/i.test(html)
      ? html.replace(/<\/head>/i, `${content}\n</head>`)
      : `${content}\n${html}`;
  }

  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${content}\n</body>`)
    : `${html}\n${content}`;
}

export async function renderSlot(
  slots: Slots,
  name = "default",
  fallback = "",
  data?: unknown,
): Promise<string> {
  const slot = slots[name];
  return slot ? await slot(data) : fallback;
}

export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[]
  | Record<string, unknown>;

export function serializeClass(value: ClassValue): string {
  const classes: string[] = [];
  collectClass(value, classes);
  return classes.join(" ");
}

export type StyleValue =
  | string
  | null
  | undefined
  | false
  | Record<string, string | number | null | undefined | false>
  | StyleValue[];

export function serializeStyle(value: StyleValue): string {
  const declarations: string[] = [];
  collectStyle(value, declarations);
  return declarations.join("; ");
}

function collectClass(value: ClassValue, classes: string[]): void {
  if (!value) {
    return;
  }

  if (typeof value === "string" || typeof value === "number") {
    classes.push(String(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectClass(item, classes);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [key, enabled] of Object.entries(value)) {
      if (enabled) {
        classes.push(key);
      }
    }
  }
}

function collectStyle(value: StyleValue, declarations: string[]): void {
  if (!value) {
    return;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(/;$/, "");

    if (normalized) {
      declarations.push(normalized);
    }

    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStyle(item, declarations);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [key, rawValue] of Object.entries(value)) {
      if (rawValue === false || rawValue === null || rawValue === undefined) {
        continue;
      }

      declarations.push(`${toKebabCase(key)}: ${String(rawValue)}`);
    }
  }
}

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}
