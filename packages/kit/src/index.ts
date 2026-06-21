/** Function shape used by compiled components to render slot content. */
export type SlotFn<T = unknown> = (data?: T) => string | Promise<string>;

/** Runtime slot table passed from a parent component to a child component. */
export type Slots = Record<string, SlotFn | undefined>;

/**
 * Shared render context passed through compiled component renders.
 *
 * `provides` stores `$provide`/`$inject` values. Values are intentionally shared
 * by reference, so functions, class instances, registries, and mutable services
 * can be passed through context.
 */
export type SlateContext = {
  provides?: Record<string, unknown>;
  assets?: SlateAssets;
};

/** Collected global assets emitted by `is:global` script/style blocks. */
export type SlateAssets = {
  head: Map<string, string>;
  tail: Map<string, string>;
};

/** Original Slate source location attached to runtime render errors. */
export type SlateSourceLocation = {
  filename: string;
  range: {
    start: number;
    end: number;
  };
  kind: "script" | "template" | "slot" | "component";
};

/**
 * Error wrapper used when generated render code can map an exception back to a
 * `.slate` source range.
 */
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

/** Evaluate a generated expression and wrap thrown errors with Slate metadata. */
export function evaluateSlateExpression<T>(fn: () => T, location: SlateSourceLocation): T {
  try {
    return fn();
  } catch (cause) {
    throw new SlateRenderError(cause, location);
  }
}

/** Escape a value for safe HTML text/attribute interpolation. */
export function escapeHTML(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Create a child render context.
 *
 * This is a shallow context fork: the `provides` table itself is copied so child
 * providers do not overwrite parent keys, but provided values remain shared by
 * reference. Asset collection is intentionally shared across the render tree.
 */
export function cloneContext(context: SlateContext = {}): SlateContext {
  return {
    ...context,
    provides: {
      ...(context.provides ?? {}),
    },
    assets: context.assets ?? createSlateAssets(),
  };
}

/** Create an empty global asset collection for one render pass. */
export function createSlateAssets(): SlateAssets {
  return {
    head: new Map<string, string>(),
    tail: new Map<string, string>(),
  };
}

/**
 * Register global HTML emitted by an `is:global` block.
 *
 * Assets are deduplicated by their final HTML and injection position. The empty
 * string return value lets generated code call this where inline HTML would
 * otherwise be appended.
 */
export function addGlobalAsset(context: SlateContext, position: "head" | "tail", html: string): string {
  const assets = context.assets ?? (context.assets = createSlateAssets());
  const key = `${position}:${html}`;
  assets[position].set(key, html);
  return "";
}

/** Inject all collected global assets into the final rendered HTML document. */
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

/** clsx-compatible value accepted by Slate's `class={...}` serializer. */
export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[]
  | Record<string, unknown>;

/** Serialize Slate `class={...}` values into a space-separated class string. */
export function serializeClass(value: ClassValue): string {
  const classes: string[] = [];
  collectClass(value, classes);
  return classes.join(" ");
}

/** Value accepted by Slate's `style={...}` serializer. */
export type StyleValue =
  | string
  | null
  | undefined
  | false
  | Record<string, string | number | null | undefined | false>
  | StyleValue[];

/** Serialize Slate `style={...}` values into a CSS declaration string. */
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
