export type SlotFn<T = unknown> = (data?: T) => string | Promise<string>;

export type Slots = Record<string, SlotFn | undefined>;

export type SlateContext = {
  provides?: Record<string, unknown>;
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
  };
}

export function cloneData<T>(value: T): T {
  assertCloneable(value);
  return structuredClone(value);
}

export function assertCloneable(value: unknown, seen: Set<unknown> = new Set<unknown>()): void {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return;
  }

  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new TypeError("Slate context values must be cloneable data.");
  }

  if (typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    throw new TypeError("Slate context values must not contain cycles.");
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      assertCloneable(item, seen);
    }
    return;
  }

  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError("Slate context values must be plain objects or arrays.");
  }

  for (const item of Object.values(value)) {
    assertCloneable(item, seen);
  }
}

export async function renderSlot(
  slots: Slots,
  name = "default",
  fallback = "",
  data?: unknown,
): Promise<string> {
  const slot = slots[name];
  return slot ? await slot(data === undefined ? undefined : cloneData(data)) : fallback;
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
