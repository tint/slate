import type { ClassValue, JsxIntrinsicElements, JsxProps, StyleValue } from "./jsx-types";

export type {
  AriaAttributes,
  AriaAutocomplete,
  AriaBoolean,
  AriaBooleanish,
  AriaCurrent,
  AriaHasPopup,
  AriaInvalid,
  AriaLive,
  AriaOrientation,
  AriaRelevant,
  AriaRole,
  AriaSort,
  ClassValue,
  JsxAriaValue,
  JsxAttributePrimitive,
  JsxBooleanish,
  JsxCrossOrigin,
  JsxEventAttributes,
  JsxEventAttributeValue,
  JsxFetchPriority,
  JsxGlobalAttributes,
  JsxHTMLAttributes,
  JsxAnchorAttributes,
  JsxButtonAttributes,
  JsxFormAttributes,
  JsxIframeAttributes,
  JsxImgAttributes,
  JsxInputAttributes,
  JsxIntrinsicElements,
  JsxLabelAttributes,
  JsxLinkAttributes,
  JsxMediaAttributes,
  JsxMetaAttributes,
  JsxOptionAttributes,
  JsxProps,
  JsxReferrerPolicy,
  JsxScriptAttributes,
  JsxSelectAttributes,
  JsxSlotAttributes,
  JsxSourceAttributes,
  JsxSVGAttributes,
  JsxTextareaAttributes,
  JsxTrackAttributes,
  StyleValue,
} from "./jsx-types";

/** Runtime brand used to mark HTML that Slate has already rendered safely. */
export const SLATE_HTML: unique symbol = Symbol.for("slate.html") as never;

/** HTML fragment that should be inserted without escaping. */
export type SlateHTML = {
  readonly [SLATE_HTML]: true;
  readonly value: string;
};

/** Primitive values accepted by normal `{expression}` interpolation. */
export type RenderPrimitive =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined;

/** Value accepted by normal `{expression}` interpolation. */
export type RenderValue =
  | RenderPrimitive
  | SlateHTML
  | readonly RenderValue[]
  | Promise<RenderPrimitive | SlateHTML | readonly RenderValue[]>;

/** Safe HTML result returned by components, slots, and render functions. */
export type RenderResult = SlateHTML | Promise<SlateHTML>;

/** Function shape used by components, slots, and future render runes. */
export type RenderFunction<TInput = void> = [TInput] extends [void]
  ? () => RenderResult
  : (input: TInput) => RenderResult;

declare global {
  namespace JSX {
    type Element = RenderResult;

    interface ElementChildrenAttribute {
      children: {};
    }

    interface IntrinsicElements extends JsxIntrinsicElements {}
  }
}

/** Function shape used by compiled components to render slot content. */
export type SlotFn<T = unknown> = (data?: T) => RenderResult;

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
    const value = fn();

    if (isPromiseLike(value)) {
      return value.catch((cause: unknown) => {
        throw new SlateRenderError(cause, location);
      }) as T;
    }

    return value;
  } catch (cause) {
    throw new SlateRenderError(cause, location);
  }
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value && typeof value === "object" && typeof (value as Promise<unknown>).then === "function");
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

/** Mark a string as safe Slate-rendered HTML. */
export function html(value: string): SlateHTML {
  return Object.freeze({
    [SLATE_HTML]: true as const,
    value,
  }) as SlateHTML;
}

/** Check whether a value is a Slate-rendered HTML fragment. */
export function isSlateHTML(value: unknown): value is SlateHTML {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as Record<PropertyKey, unknown>)[SLATE_HTML] === true,
  );
}

/** Convert a normal interpolation value into HTML text. */
export async function renderValue(value: RenderValue): Promise<string> {
  const resolved = await value;

  if (isSlateHTML(resolved)) {
    return resolved.value;
  }

  if (Array.isArray(resolved)) {
    const parts = await Promise.all(resolved.map((item) => renderValue(item)));
    return parts.join("");
  }

  if (resolved == null || typeof resolved === "boolean") {
    return "";
  }

  return escapeHTML(resolved);
}

/** Convert an explicit raw HTML value into an HTML string. */
export async function renderHTML(value: unknown): Promise<string> {
  const resolved = await value;

  if (isSlateHTML(resolved)) {
    return resolved.value;
  }

  if (resolved == null || typeof resolved === "boolean") {
    return "";
  }

  return String(resolved);
}

/** Normalize a render result into a branded Slate HTML fragment. */
export async function resolveRenderResult(value: RenderResult): Promise<SlateHTML> {
  const resolved = await value;
  return isSlateHTML(resolved) ? resolved : html(await renderHTML(resolved));
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
  fallback: RenderResult = html(""),
  data?: unknown,
): Promise<SlateHTML> {
  const slot = slots[name];
  return slot ? await resolveRenderResult(slot(data)) : await resolveRenderResult(fallback);
}

/** Fragment marker used by Slate's JSX runtime. */
export const Fragment: unique symbol = Symbol.for("slate.fragment") as never;

/** Create a Slate HTML fragment from TSX used inside `<script slate>`. */
export async function jsx(type: string | typeof Fragment, props: JsxProps | null, ...children: unknown[]): Promise<SlateHTML> {
  const normalizedChildren = children.length > 0 ? children : [props?.children];

  if (type === Fragment) {
    return html((await Promise.all(normalizedChildren.map(renderJsxChild))).join(""));
  }

  const attributes = Object.entries(props ?? {})
    .filter(([name]) => name !== "children")
    .map(([name, value]) => renderJsxAttribute(name, value))
    .join("");
  const body = (await Promise.all(normalizedChildren.map(renderJsxChild))).join("");

  if (!body && VOID_ELEMENTS.has(type)) {
    return html(`<${type}${attributes}>`);
  }

  return html(`<${type}${attributes}>${body}</${type}>`);
}

/** Alias used by TypeScript when a JSX node has multiple static children. */
export const jsxs = jsx;

function renderJsxAttribute(name: string, value: unknown): string {
  if (/^on/i.test(name) && value != null && typeof value !== "string") {
    throw new Error(`Slate JSX event handler attribute "${name}" must be a string.`);
  }

  if (typeof value === "function") {
    throw new Error(`Slate JSX cannot serialize function attribute "${name}".`);
  }

  if (name === "class") {
    const serialized = serializeClass(value as ClassValue);
    return serialized ? serializeAttribute(name, serialized) : "";
  }

  if (name === "style") {
    const serialized = serializeStyle(value as StyleValue);
    return serialized ? serializeAttribute(name, serialized) : "";
  }

  return serializeAttribute(normalizeJsxAttributeName(name), value);
}

function normalizeJsxAttributeName(name: string): string {
  return JSX_ATTRIBUTE_ALIASES[name] ?? name;
}

const JSX_ATTRIBUTE_ALIASES: Record<string, string> = {
  acceptCharset: "accept-charset",
  accentHeight: "accent-height",
  alignmentBaseline: "alignment-baseline",
  arabicForm: "arabic-form",
  baselineShift: "baseline-shift",
  capHeight: "cap-height",
  clipPath: "clip-path",
  clipPathUnits: "clipPathUnits",
  clipRule: "clip-rule",
  colorInterpolation: "color-interpolation",
  colorInterpolationFilters: "color-interpolation-filters",
  colorProfile: "color-profile",
  colorRendering: "color-rendering",
  dominantBaseline: "dominant-baseline",
  enableBackground: "enable-background",
  fillOpacity: "fill-opacity",
  fillRule: "fill-rule",
  floodColor: "flood-color",
  floodOpacity: "flood-opacity",
  fontFamily: "font-family",
  fontSize: "font-size",
  fontSizeAdjust: "font-size-adjust",
  fontStretch: "font-stretch",
  fontStyle: "font-style",
  fontVariant: "font-variant",
  fontWeight: "font-weight",
  glyphName: "glyph-name",
  glyphOrientationHorizontal: "glyph-orientation-horizontal",
  glyphOrientationVertical: "glyph-orientation-vertical",
  horizAdvX: "horiz-adv-x",
  horizOriginX: "horiz-origin-x",
  httpEquiv: "http-equiv",
  imageRendering: "image-rendering",
  letterSpacing: "letter-spacing",
  lightingColor: "lighting-color",
  markerEnd: "marker-end",
  markerMid: "marker-mid",
  markerStart: "marker-start",
  overlinePosition: "overline-position",
  overlineThickness: "overline-thickness",
  paintOrder: "paint-order",
  panose1: "panose-1",
  pointerEvents: "pointer-events",
  shapeRendering: "shape-rendering",
  stopColor: "stop-color",
  stopOpacity: "stop-opacity",
  strikethroughPosition: "strikethrough-position",
  strikethroughThickness: "strikethrough-thickness",
  strokeDasharray: "stroke-dasharray",
  strokeDashoffset: "stroke-dashoffset",
  strokeLinecap: "stroke-linecap",
  strokeLinejoin: "stroke-linejoin",
  strokeMiterlimit: "stroke-miterlimit",
  strokeOpacity: "stroke-opacity",
  strokeWidth: "stroke-width",
  textAnchor: "text-anchor",
  textDecoration: "text-decoration",
  textRendering: "text-rendering",
  transformOrigin: "transform-origin",
  underlinePosition: "underline-position",
  underlineThickness: "underline-thickness",
  unicodeBidi: "unicode-bidi",
  unicodeRange: "unicode-range",
  unitsPerEm: "units-per-em",
  vectorEffect: "vector-effect",
  vertAdvY: "vert-adv-y",
  vertOriginX: "vert-origin-x",
  vertOriginY: "vert-origin-y",
  wordSpacing: "word-spacing",
  writingMode: "writing-mode",
  xHeight: "x-height",
  xlinkActuate: "xlink:actuate",
  xlinkArcrole: "xlink:arcrole",
  xlinkHref: "xlink:href",
  xlinkRole: "xlink:role",
  xlinkShow: "xlink:show",
  xlinkTitle: "xlink:title",
  xlinkType: "xlink:type",
  xmlBase: "xml:base",
  xmlLang: "xml:lang",
  xmlSpace: "xml:space",
};

async function renderJsxChild(value: unknown): Promise<string> {
  const resolved = await value;

  if (Array.isArray(resolved)) {
    return (await Promise.all(resolved.map(renderJsxChild))).join("");
  }

  if (isSlateHTML(resolved)) {
    return resolved.value;
  }

  if (resolved == null || typeof resolved === "boolean") {
    return "";
  }

  return escapeHTML(resolved);
}

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const BOOLEAN_ATTRIBUTES = new Set([
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "formnovalidate",
  "hidden",
  "inert",
  "ismap",
  "itemscope",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "selected",
]);

const BOOLEANISH_STRING_ATTRIBUTES = new Set([
  "contenteditable",
  "draggable",
  "spellcheck",
]);

/** Serialize an expression-backed HTML attribute. */
export function serializeAttribute(name: string, value: unknown, quote = "\""): string {
  if (value == null) {
    return "";
  }

  const normalizedName = name.toLowerCase();
  const attributeValue = isSlateHTML(value) ? value.value : value;

  if (typeof attributeValue === "boolean") {
    if (BOOLEAN_ATTRIBUTES.has(normalizedName)) {
      return attributeValue ? ` ${name}` : "";
    }

    if (normalizedName === "translate") {
      return ` ${name}=${quote}${attributeValue ? "yes" : "no"}${quote}`;
    }

    if (
      normalizedName.startsWith("aria-") ||
      normalizedName.startsWith("data-") ||
      BOOLEANISH_STRING_ATTRIBUTES.has(normalizedName)
    ) {
      return ` ${name}=${quote}${attributeValue ? "true" : "false"}${quote}`;
    }

    if (!attributeValue) {
      return "";
    }
  }

  return ` ${name}=${quote}${escapeHTML(attributeValue)}${quote}`;
}

/** Serialize Slate `class={...}` values into a space-separated class string. */
export function serializeClass(value: ClassValue): string {
  const classes: string[] = [];
  collectClass(value, classes);
  return classes.join(" ");
}

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
