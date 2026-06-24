/** Primitive value accepted by JSX HTML attributes. */
export type JsxAttributePrimitive =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined;

/** clsx-compatible value accepted by Slate's `class={...}` serializer. */
export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[]
  | Record<string, unknown>;

/** Value accepted by Slate's `style={...}` serializer. */
export type StyleValue =
  | string
  | null
  | undefined
  | false
  | Record<string, string | number | null | undefined | false>
  | StyleValue[];

export type JsxAriaValue = string | number | boolean | null | undefined;
export type JsxEventAttributeValue = string | null | undefined;

export type AriaRole =
  | "alert"
  | "alertdialog"
  | "application"
  | "article"
  | "banner"
  | "button"
  | "cell"
  | "checkbox"
  | "columnheader"
  | "combobox"
  | "complementary"
  | "contentinfo"
  | "definition"
  | "dialog"
  | "directory"
  | "document"
  | "feed"
  | "figure"
  | "form"
  | "grid"
  | "gridcell"
  | "group"
  | "heading"
  | "img"
  | "link"
  | "list"
  | "listbox"
  | "listitem"
  | "log"
  | "main"
  | "marquee"
  | "math"
  | "menu"
  | "menubar"
  | "menuitem"
  | "menuitemcheckbox"
  | "menuitemradio"
  | "meter"
  | "navigation"
  | "none"
  | "note"
  | "option"
  | "presentation"
  | "progressbar"
  | "radio"
  | "radiogroup"
  | "region"
  | "row"
  | "rowgroup"
  | "rowheader"
  | "scrollbar"
  | "search"
  | "searchbox"
  | "separator"
  | "slider"
  | "spinbutton"
  | "status"
  | "switch"
  | "tab"
  | "table"
  | "tablist"
  | "tabpanel"
  | "term"
  | "textbox"
  | "timer"
  | "toolbar"
  | "tooltip"
  | "tree"
  | "treegrid"
  | "treeitem"
  | (string & {});

export type AriaBoolean = boolean | "true" | "false";
export type AriaBooleanish = AriaBoolean | null | undefined;
export type AriaCurrent = boolean | "false" | "true" | "page" | "step" | "location" | "date" | "time" | null | undefined;
export type AriaInvalid = boolean | "false" | "true" | "grammar" | "spelling" | null | undefined;
export type AriaLive = "off" | "assertive" | "polite" | null | undefined;
export type AriaOrientation = "horizontal" | "vertical" | null | undefined;
export type AriaRelevant =
  | "additions"
  | "additions removals"
  | "additions text"
  | "all"
  | "removals"
  | "removals additions"
  | "removals text"
  | "text"
  | "text additions"
  | "text removals"
  | null
  | undefined;
export type AriaSort = "none" | "ascending" | "descending" | "other" | null | undefined;
export type AriaAutocomplete = "none" | "inline" | "list" | "both" | null | undefined;
export type AriaHasPopup = boolean | "false" | "true" | "menu" | "listbox" | "tree" | "grid" | "dialog" | null | undefined;

export type AriaAttributes = {
  "aria-activedescendant"?: string | null | undefined;
  "aria-atomic"?: AriaBooleanish;
  "aria-autocomplete"?: AriaAutocomplete;
  "aria-braillelabel"?: string | null | undefined;
  "aria-brailleroledescription"?: string | null | undefined;
  "aria-busy"?: AriaBooleanish;
  "aria-checked"?: boolean | "false" | "mixed" | "true" | null | undefined;
  "aria-colcount"?: string | number | null | undefined;
  "aria-colindex"?: string | number | null | undefined;
  "aria-colindextext"?: string | null | undefined;
  "aria-colspan"?: string | number | null | undefined;
  "aria-controls"?: string | null | undefined;
  "aria-current"?: AriaCurrent;
  "aria-describedby"?: string | null | undefined;
  "aria-description"?: string | null | undefined;
  "aria-details"?: string | null | undefined;
  "aria-disabled"?: AriaBooleanish;
  "aria-dropeffect"?: "copy" | "execute" | "link" | "move" | "none" | "popup" | null | undefined;
  "aria-errormessage"?: string | null | undefined;
  "aria-expanded"?: AriaBooleanish;
  "aria-flowto"?: string | null | undefined;
  "aria-grabbed"?: AriaBooleanish;
  "aria-haspopup"?: AriaHasPopup;
  "aria-hidden"?: AriaBooleanish;
  "aria-invalid"?: AriaInvalid;
  "aria-keyshortcuts"?: string | null | undefined;
  "aria-label"?: string | null | undefined;
  "aria-labelledby"?: string | null | undefined;
  "aria-level"?: string | number | null | undefined;
  "aria-live"?: AriaLive;
  "aria-modal"?: AriaBooleanish;
  "aria-multiline"?: AriaBooleanish;
  "aria-multiselectable"?: AriaBooleanish;
  "aria-orientation"?: AriaOrientation;
  "aria-owns"?: string | null | undefined;
  "aria-placeholder"?: string | null | undefined;
  "aria-posinset"?: string | number | null | undefined;
  "aria-pressed"?: boolean | "false" | "mixed" | "true" | null | undefined;
  "aria-readonly"?: AriaBooleanish;
  "aria-relevant"?: AriaRelevant;
  "aria-required"?: AriaBooleanish;
  "aria-roledescription"?: string | null | undefined;
  "aria-rowcount"?: string | number | null | undefined;
  "aria-rowindex"?: string | number | null | undefined;
  "aria-rowindextext"?: string | null | undefined;
  "aria-rowspan"?: string | number | null | undefined;
  "aria-selected"?: AriaBooleanish;
  "aria-setsize"?: string | number | null | undefined;
  "aria-sort"?: AriaSort;
  "aria-valuemax"?: string | number | null | undefined;
  "aria-valuemin"?: string | number | null | undefined;
  "aria-valuenow"?: string | number | null | undefined;
  "aria-valuetext"?: string | null | undefined;
};

export type JsxBooleanish = boolean | "true" | "false" | null | undefined;
export type JsxCrossOrigin = "anonymous" | "use-credentials" | "" | null | undefined;
export type JsxFetchPriority = "high" | "low" | "auto" | null | undefined;
export type JsxReferrerPolicy =
  | ""
  | "no-referrer"
  | "no-referrer-when-downgrade"
  | "origin"
  | "origin-when-cross-origin"
  | "same-origin"
  | "strict-origin"
  | "strict-origin-when-cross-origin"
  | "unsafe-url"
  | null
  | undefined;

export type JsxGlobalAttributes = AriaAttributes & {
  children?: unknown;
  accesskey?: string | null | undefined;
  autocapitalize?: string | null | undefined;
  autofocus?: boolean | null | undefined;
  class?: ClassValue;
  contenteditable?: boolean | "true" | "false" | "plaintext-only" | null | undefined;
  dir?: "ltr" | "rtl" | "auto" | null | undefined;
  draggable?: JsxBooleanish;
  enterkeyhint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send" | null | undefined;
  exportparts?: string | null | undefined;
  hidden?: boolean | "hidden" | "until-found" | null | undefined;
  id?: string | null | undefined;
  inert?: boolean | null | undefined;
  inputmode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url" | null | undefined;
  is?: string | null | undefined;
  itemid?: string | null | undefined;
  itemprop?: string | null | undefined;
  itemref?: string | null | undefined;
  itemscope?: boolean | null | undefined;
  itemtype?: string | null | undefined;
  lang?: string | null | undefined;
  nonce?: string | null | undefined;
  part?: string | null | undefined;
  popover?: boolean | "auto" | "manual" | null | undefined;
  role?: AriaRole | null | undefined;
  slot?: string | null | undefined;
  spellcheck?: JsxBooleanish;
  style?: StyleValue;
  tabindex?: string | number | null | undefined;
  title?: string | null | undefined;
  translate?: "yes" | "no" | boolean | null | undefined;
  virtualkeyboardpolicy?: "auto" | "manual" | null | undefined;
  writingsuggestions?: JsxBooleanish;

  [name: string]: unknown;
  [name: `aria-${string}`]: JsxAriaValue;
  [name: `data-${string}`]: unknown;
  [name: `dev:${string}`]: unknown;
  [name: `is:${string}`]: unknown;
  [name: `slot:${string}`]: unknown;
};

export type JsxEventAttributes = {
  onabort?: JsxEventAttributeValue;
  onanimationcancel?: JsxEventAttributeValue;
  onanimationend?: JsxEventAttributeValue;
  onanimationiteration?: JsxEventAttributeValue;
  onanimationstart?: JsxEventAttributeValue;
  onauxclick?: JsxEventAttributeValue;
  onbeforeinput?: JsxEventAttributeValue;
  onbeforematch?: JsxEventAttributeValue;
  onbeforetoggle?: JsxEventAttributeValue;
  onblur?: JsxEventAttributeValue;
  oncancel?: JsxEventAttributeValue;
  oncanplay?: JsxEventAttributeValue;
  oncanplaythrough?: JsxEventAttributeValue;
  onchange?: JsxEventAttributeValue;
  onclick?: JsxEventAttributeValue;
  onclose?: JsxEventAttributeValue;
  oncontextlost?: JsxEventAttributeValue;
  oncontextmenu?: JsxEventAttributeValue;
  oncontextrestored?: JsxEventAttributeValue;
  oncopy?: JsxEventAttributeValue;
  oncuechange?: JsxEventAttributeValue;
  oncut?: JsxEventAttributeValue;
  ondblclick?: JsxEventAttributeValue;
  ondrag?: JsxEventAttributeValue;
  ondragend?: JsxEventAttributeValue;
  ondragenter?: JsxEventAttributeValue;
  ondragleave?: JsxEventAttributeValue;
  ondragover?: JsxEventAttributeValue;
  ondragstart?: JsxEventAttributeValue;
  ondrop?: JsxEventAttributeValue;
  ondurationchange?: JsxEventAttributeValue;
  onemptied?: JsxEventAttributeValue;
  onended?: JsxEventAttributeValue;
  onerror?: JsxEventAttributeValue;
  onfocus?: JsxEventAttributeValue;
  onformdata?: JsxEventAttributeValue;
  ongotpointercapture?: JsxEventAttributeValue;
  oninput?: JsxEventAttributeValue;
  oninvalid?: JsxEventAttributeValue;
  onkeydown?: JsxEventAttributeValue;
  onkeypress?: JsxEventAttributeValue;
  onkeyup?: JsxEventAttributeValue;
  onload?: JsxEventAttributeValue;
  onloadeddata?: JsxEventAttributeValue;
  onloadedmetadata?: JsxEventAttributeValue;
  onloadstart?: JsxEventAttributeValue;
  onlostpointercapture?: JsxEventAttributeValue;
  onmousedown?: JsxEventAttributeValue;
  onmouseenter?: JsxEventAttributeValue;
  onmouseleave?: JsxEventAttributeValue;
  onmousemove?: JsxEventAttributeValue;
  onmouseout?: JsxEventAttributeValue;
  onmouseover?: JsxEventAttributeValue;
  onmouseup?: JsxEventAttributeValue;
  onpaste?: JsxEventAttributeValue;
  onpause?: JsxEventAttributeValue;
  onplay?: JsxEventAttributeValue;
  onplaying?: JsxEventAttributeValue;
  onpointercancel?: JsxEventAttributeValue;
  onpointerdown?: JsxEventAttributeValue;
  onpointerenter?: JsxEventAttributeValue;
  onpointerleave?: JsxEventAttributeValue;
  onpointermove?: JsxEventAttributeValue;
  onpointerout?: JsxEventAttributeValue;
  onpointerover?: JsxEventAttributeValue;
  onpointerrawupdate?: JsxEventAttributeValue;
  onpointerup?: JsxEventAttributeValue;
  onprogress?: JsxEventAttributeValue;
  onratechange?: JsxEventAttributeValue;
  onreset?: JsxEventAttributeValue;
  onresize?: JsxEventAttributeValue;
  onscroll?: JsxEventAttributeValue;
  onscrollend?: JsxEventAttributeValue;
  onsecuritypolicyviolation?: JsxEventAttributeValue;
  onseeked?: JsxEventAttributeValue;
  onseeking?: JsxEventAttributeValue;
  onselect?: JsxEventAttributeValue;
  onslotchange?: JsxEventAttributeValue;
  onstalled?: JsxEventAttributeValue;
  onsubmit?: JsxEventAttributeValue;
  onsuspend?: JsxEventAttributeValue;
  ontimeupdate?: JsxEventAttributeValue;
  ontoggle?: JsxEventAttributeValue;
  ontouchcancel?: JsxEventAttributeValue;
  ontouchend?: JsxEventAttributeValue;
  ontouchmove?: JsxEventAttributeValue;
  ontouchstart?: JsxEventAttributeValue;
  ontransitioncancel?: JsxEventAttributeValue;
  ontransitionend?: JsxEventAttributeValue;
  ontransitionrun?: JsxEventAttributeValue;
  ontransitionstart?: JsxEventAttributeValue;
  onvolumechange?: JsxEventAttributeValue;
  onwaiting?: JsxEventAttributeValue;
  onwebkitanimationend?: JsxEventAttributeValue;
  onwebkitanimationiteration?: JsxEventAttributeValue;
  onwebkitanimationstart?: JsxEventAttributeValue;
  onwebkittransitionend?: JsxEventAttributeValue;
  onwheel?: JsxEventAttributeValue;

  [name: `on${string}`]: JsxEventAttributeValue;
};

export type JsxHTMLAttributes = JsxGlobalAttributes & JsxEventAttributes & {
  accept?: string | null | undefined;
  acceptcharset?: string | null | undefined;
  action?: string | null | undefined;
  allow?: string | null | undefined;
  allowfullscreen?: boolean | null | undefined;
  allowpaymentrequest?: boolean | null | undefined;
  alt?: string | null | undefined;
  as?: string | null | undefined;
  async?: boolean | null | undefined;
  autocomplete?: string | null | undefined;
  autoplay?: boolean | null | undefined;
  blocking?: string | null | undefined;
  capture?: boolean | "user" | "environment" | null | undefined;
  charset?: string | null | undefined;
  checked?: boolean | null | undefined;
  cite?: string | null | undefined;
  cols?: string | number | null | undefined;
  colspan?: string | number | null | undefined;
  command?: string | null | undefined;
  commandfor?: string | null | undefined;
  content?: string | null | undefined;
  controls?: boolean | null | undefined;
  controlslist?: string | null | undefined;
  coords?: string | null | undefined;
  crossorigin?: JsxCrossOrigin;
  data?: string | null | undefined;
  datetime?: string | null | undefined;
  decoding?: "async" | "auto" | "sync" | null | undefined;
  default?: boolean | null | undefined;
  defer?: boolean | null | undefined;
  dirname?: string | null | undefined;
  disabled?: boolean | null | undefined;
  disablepictureinpicture?: boolean | null | undefined;
  disableremoteplayback?: boolean | null | undefined;
  download?: boolean | string | null | undefined;
  enctype?: string | null | undefined;
  fetchpriority?: JsxFetchPriority;
  for?: string | null | undefined;
  form?: string | null | undefined;
  formaction?: string | null | undefined;
  formenctype?: string | null | undefined;
  formmethod?: string | null | undefined;
  formnovalidate?: boolean | null | undefined;
  formtarget?: string | null | undefined;
  headers?: string | null | undefined;
  height?: string | number | null | undefined;
  high?: string | number | null | undefined;
  href?: string | null | undefined;
  hreflang?: string | null | undefined;
  httpEquiv?: string | null | undefined;
  httpequiv?: string | null | undefined;
  imagesizes?: string | null | undefined;
  imagesrcset?: string | null | undefined;
  integrity?: string | null | undefined;
  kind?: string | null | undefined;
  label?: string | null | undefined;
  list?: string | null | undefined;
  loading?: "eager" | "lazy" | null | undefined;
  loop?: boolean | null | undefined;
  low?: string | number | null | undefined;
  max?: string | number | null | undefined;
  maxlength?: string | number | null | undefined;
  media?: string | null | undefined;
  method?: string | null | undefined;
  min?: string | number | null | undefined;
  minlength?: string | number | null | undefined;
  multiple?: boolean | null | undefined;
  muted?: boolean | null | undefined;
  name?: string | null | undefined;
  nomodule?: boolean | null | undefined;
  novalidate?: boolean | null | undefined;
  open?: boolean | null | undefined;
  optimum?: string | number | null | undefined;
  pattern?: string | null | undefined;
  ping?: string | null | undefined;
  placeholder?: string | null | undefined;
  playsinline?: boolean | null | undefined;
  popovertarget?: string | null | undefined;
  popovertargetaction?: "hide" | "show" | "toggle" | null | undefined;
  poster?: string | null | undefined;
  preload?: string | null | undefined;
  readonly?: boolean | null | undefined;
  referrerpolicy?: JsxReferrerPolicy;
  rel?: string | null | undefined;
  required?: boolean | null | undefined;
  reversed?: boolean | null | undefined;
  rows?: string | number | null | undefined;
  rowspan?: string | number | null | undefined;
  sandbox?: string | null | undefined;
  scope?: string | null | undefined;
  selected?: boolean | null | undefined;
  shadowrootclonable?: boolean | null | undefined;
  shadowrootdelegatesfocus?: boolean | null | undefined;
  shadowrootmode?: "open" | "closed" | null | undefined;
  shape?: string | null | undefined;
  size?: string | number | null | undefined;
  sizes?: string | null | undefined;
  span?: string | number | null | undefined;
  src?: string | null | undefined;
  srcdoc?: string | null | undefined;
  srclang?: string | null | undefined;
  srcset?: string | null | undefined;
  start?: string | number | null | undefined;
  step?: string | number | null | undefined;
  target?: string | null | undefined;
  type?: string | null | undefined;
  usemap?: string | null | undefined;
  value?: string | number | readonly string[] | null | undefined;
  width?: string | number | null | undefined;
  wrap?: string | null | undefined;
};

export type JsxSVGAttributes = JsxGlobalAttributes & JsxEventAttributes & {
  accentHeight?: string | number | null | undefined;
  "accent-height"?: string | number | null | undefined;
  accumulate?: string | null | undefined;
  additive?: string | null | undefined;
  alignmentBaseline?: string | null | undefined;
  "alignment-baseline"?: string | null | undefined;
  allowReorder?: string | null | undefined;
  alphabetic?: string | number | null | undefined;
  amplitude?: string | number | null | undefined;
  arabicForm?: string | null | undefined;
  "arabic-form"?: string | null | undefined;
  ascent?: string | number | null | undefined;
  attributeName?: string | null | undefined;
  attributeType?: string | null | undefined;
  azimuth?: string | number | null | undefined;
  baseFrequency?: string | number | null | undefined;
  baselineShift?: string | number | null | undefined;
  "baseline-shift"?: string | number | null | undefined;
  baseProfile?: string | null | undefined;
  bbox?: string | null | undefined;
  begin?: string | null | undefined;
  bias?: string | number | null | undefined;
  by?: string | number | null | undefined;
  calcMode?: string | null | undefined;
  capHeight?: string | number | null | undefined;
  "cap-height"?: string | number | null | undefined;
  clip?: string | null | undefined;
  clipPath?: string | null | undefined;
  "clip-path"?: string | null | undefined;
  clipPathUnits?: string | null | undefined;
  clipRule?: string | null | undefined;
  "clip-rule"?: string | null | undefined;
  color?: string | null | undefined;
  colorInterpolation?: string | null | undefined;
  "color-interpolation"?: string | null | undefined;
  colorInterpolationFilters?: string | null | undefined;
  "color-interpolation-filters"?: string | null | undefined;
  colorProfile?: string | null | undefined;
  "color-profile"?: string | null | undefined;
  colorRendering?: string | null | undefined;
  "color-rendering"?: string | null | undefined;
  contentScriptType?: string | null | undefined;
  contentStyleType?: string | null | undefined;
  cursor?: string | null | undefined;
  cx?: string | number | null | undefined;
  cy?: string | number | null | undefined;
  d?: string | null | undefined;
  decelerate?: string | number | null | undefined;
  descent?: string | number | null | undefined;
  diffuseConstant?: string | number | null | undefined;
  direction?: string | null | undefined;
  display?: string | null | undefined;
  divisor?: string | number | null | undefined;
  dominantBaseline?: string | null | undefined;
  "dominant-baseline"?: string | null | undefined;
  dur?: string | null | undefined;
  dx?: string | number | null | undefined;
  dy?: string | number | null | undefined;
  edgeMode?: string | null | undefined;
  elevation?: string | number | null | undefined;
  enableBackground?: string | null | undefined;
  "enable-background"?: string | null | undefined;
  end?: string | null | undefined;
  exponent?: string | number | null | undefined;
  externalResourcesRequired?: string | null | undefined;
  fill?: string | null | undefined;
  fillOpacity?: string | number | null | undefined;
  "fill-opacity"?: string | number | null | undefined;
  fillRule?: string | null | undefined;
  "fill-rule"?: string | null | undefined;
  filter?: string | null | undefined;
  filterRes?: string | number | null | undefined;
  filterUnits?: string | null | undefined;
  floodColor?: string | null | undefined;
  "flood-color"?: string | null | undefined;
  floodOpacity?: string | number | null | undefined;
  "flood-opacity"?: string | number | null | undefined;
  focusable?: JsxBooleanish;
  fontFamily?: string | null | undefined;
  "font-family"?: string | null | undefined;
  fontSize?: string | number | null | undefined;
  "font-size"?: string | number | null | undefined;
  fontSizeAdjust?: string | number | null | undefined;
  "font-size-adjust"?: string | number | null | undefined;
  fontStretch?: string | null | undefined;
  "font-stretch"?: string | null | undefined;
  fontStyle?: string | null | undefined;
  "font-style"?: string | null | undefined;
  fontVariant?: string | null | undefined;
  "font-variant"?: string | null | undefined;
  fontWeight?: string | number | null | undefined;
  "font-weight"?: string | number | null | undefined;
  from?: string | number | null | undefined;
  fx?: string | number | null | undefined;
  fy?: string | number | null | undefined;
  g1?: string | null | undefined;
  g2?: string | null | undefined;
  glyphName?: string | null | undefined;
  "glyph-name"?: string | null | undefined;
  glyphOrientationHorizontal?: string | null | undefined;
  "glyph-orientation-horizontal"?: string | null | undefined;
  glyphOrientationVertical?: string | null | undefined;
  "glyph-orientation-vertical"?: string | null | undefined;
  glyphRef?: string | null | undefined;
  gradientTransform?: string | null | undefined;
  gradientUnits?: string | null | undefined;
  hanging?: string | number | null | undefined;
  horizAdvX?: string | number | null | undefined;
  "horiz-adv-x"?: string | number | null | undefined;
  horizOriginX?: string | number | null | undefined;
  "horiz-origin-x"?: string | number | null | undefined;
  href?: string | null | undefined;
  ideographic?: string | number | null | undefined;
  imageRendering?: string | null | undefined;
  "image-rendering"?: string | null | undefined;
  in?: string | null | undefined;
  in2?: string | null | undefined;
  intercept?: string | number | null | undefined;
  k?: string | number | null | undefined;
  k1?: string | number | null | undefined;
  k2?: string | number | null | undefined;
  k3?: string | number | null | undefined;
  k4?: string | number | null | undefined;
  kernelMatrix?: string | null | undefined;
  kernelUnitLength?: string | number | null | undefined;
  kerning?: string | number | null | undefined;
  keyPoints?: string | null | undefined;
  keySplines?: string | null | undefined;
  keyTimes?: string | null | undefined;
  lengthAdjust?: string | null | undefined;
  letterSpacing?: string | number | null | undefined;
  "letter-spacing"?: string | number | null | undefined;
  lightingColor?: string | null | undefined;
  "lighting-color"?: string | null | undefined;
  limitingConeAngle?: string | number | null | undefined;
  local?: string | null | undefined;
  markerEnd?: string | null | undefined;
  "marker-end"?: string | null | undefined;
  markerHeight?: string | number | null | undefined;
  markerMid?: string | null | undefined;
  "marker-mid"?: string | null | undefined;
  markerStart?: string | null | undefined;
  "marker-start"?: string | null | undefined;
  markerUnits?: string | null | undefined;
  markerWidth?: string | number | null | undefined;
  mask?: string | null | undefined;
  maskContentUnits?: string | null | undefined;
  maskUnits?: string | null | undefined;
  mathematical?: string | number | null | undefined;
  mode?: string | null | undefined;
  numOctaves?: string | number | null | undefined;
  offset?: string | number | null | undefined;
  opacity?: string | number | null | undefined;
  operator?: string | null | undefined;
  order?: string | number | null | undefined;
  orient?: string | null | undefined;
  orientation?: string | null | undefined;
  origin?: string | null | undefined;
  overflow?: string | null | undefined;
  overlinePosition?: string | number | null | undefined;
  "overline-position"?: string | number | null | undefined;
  overlineThickness?: string | number | null | undefined;
  "overline-thickness"?: string | number | null | undefined;
  paintOrder?: string | null | undefined;
  "paint-order"?: string | null | undefined;
  panose1?: string | null | undefined;
  "panose-1"?: string | null | undefined;
  path?: string | null | undefined;
  pathLength?: string | number | null | undefined;
  patternContentUnits?: string | null | undefined;
  patternTransform?: string | null | undefined;
  patternUnits?: string | null | undefined;
  pointerEvents?: string | null | undefined;
  "pointer-events"?: string | null | undefined;
  points?: string | null | undefined;
  pointsAtX?: string | number | null | undefined;
  pointsAtY?: string | number | null | undefined;
  pointsAtZ?: string | number | null | undefined;
  preserveAlpha?: boolean | null | undefined;
  preserveAspectRatio?: string | null | undefined;
  primitiveUnits?: string | null | undefined;
  r?: string | number | null | undefined;
  radius?: string | number | null | undefined;
  refX?: string | number | null | undefined;
  refY?: string | number | null | undefined;
  renderingIntent?: string | null | undefined;
  repeatCount?: string | number | null | undefined;
  repeatDur?: string | null | undefined;
  requiredExtensions?: string | null | undefined;
  requiredFeatures?: string | null | undefined;
  restart?: string | null | undefined;
  result?: string | null | undefined;
  rotate?: string | number | null | undefined;
  rx?: string | number | null | undefined;
  ry?: string | number | null | undefined;
  scale?: string | number | null | undefined;
  seed?: string | number | null | undefined;
  shapeRendering?: string | null | undefined;
  "shape-rendering"?: string | null | undefined;
  slope?: string | number | null | undefined;
  spacing?: string | null | undefined;
  specularConstant?: string | number | null | undefined;
  specularExponent?: string | number | null | undefined;
  speed?: string | number | null | undefined;
  spreadMethod?: string | null | undefined;
  startOffset?: string | number | null | undefined;
  stdDeviation?: string | number | null | undefined;
  stemh?: string | number | null | undefined;
  stemv?: string | number | null | undefined;
  stitchTiles?: string | null | undefined;
  stopColor?: string | null | undefined;
  "stop-color"?: string | null | undefined;
  stopOpacity?: string | number | null | undefined;
  "stop-opacity"?: string | number | null | undefined;
  strikethroughPosition?: string | number | null | undefined;
  "strikethrough-position"?: string | number | null | undefined;
  strikethroughThickness?: string | number | null | undefined;
  "strikethrough-thickness"?: string | number | null | undefined;
  string?: string | null | undefined;
  stroke?: string | null | undefined;
  strokeDasharray?: string | number | null | undefined;
  "stroke-dasharray"?: string | number | null | undefined;
  strokeDashoffset?: string | number | null | undefined;
  "stroke-dashoffset"?: string | number | null | undefined;
  strokeLinecap?: "butt" | "round" | "square" | "inherit" | null | undefined;
  "stroke-linecap"?: "butt" | "round" | "square" | "inherit" | null | undefined;
  strokeLinejoin?: "miter" | "round" | "bevel" | "inherit" | null | undefined;
  "stroke-linejoin"?: "miter" | "round" | "bevel" | "inherit" | null | undefined;
  strokeMiterlimit?: string | number | null | undefined;
  "stroke-miterlimit"?: string | number | null | undefined;
  strokeOpacity?: string | number | null | undefined;
  "stroke-opacity"?: string | number | null | undefined;
  strokeWidth?: string | number | null | undefined;
  "stroke-width"?: string | number | null | undefined;
  surfaceScale?: string | number | null | undefined;
  systemLanguage?: string | null | undefined;
  tableValues?: string | null | undefined;
  target?: string | null | undefined;
  targetX?: string | number | null | undefined;
  targetY?: string | number | null | undefined;
  textAnchor?: string | null | undefined;
  "text-anchor"?: string | null | undefined;
  textDecoration?: string | null | undefined;
  "text-decoration"?: string | null | undefined;
  textLength?: string | number | null | undefined;
  textRendering?: string | null | undefined;
  "text-rendering"?: string | null | undefined;
  to?: string | number | null | undefined;
  transform?: string | null | undefined;
  transformOrigin?: string | null | undefined;
  "transform-origin"?: string | null | undefined;
  u1?: string | null | undefined;
  u2?: string | null | undefined;
  underlinePosition?: string | number | null | undefined;
  "underline-position"?: string | number | null | undefined;
  underlineThickness?: string | number | null | undefined;
  "underline-thickness"?: string | number | null | undefined;
  unicode?: string | null | undefined;
  unicodeBidi?: string | null | undefined;
  "unicode-bidi"?: string | null | undefined;
  unicodeRange?: string | null | undefined;
  "unicode-range"?: string | null | undefined;
  unitsPerEm?: string | number | null | undefined;
  "units-per-em"?: string | number | null | undefined;
  vAlphabetic?: string | number | null | undefined;
  "v-alphabetic"?: string | number | null | undefined;
  values?: string | null | undefined;
  vectorEffect?: string | null | undefined;
  "vector-effect"?: string | null | undefined;
  version?: string | null | undefined;
  vertAdvY?: string | number | null | undefined;
  "vert-adv-y"?: string | number | null | undefined;
  vertOriginX?: string | number | null | undefined;
  "vert-origin-x"?: string | number | null | undefined;
  vertOriginY?: string | number | null | undefined;
  "vert-origin-y"?: string | number | null | undefined;
  viewBox?: string | null | undefined;
  viewTarget?: string | null | undefined;
  visibility?: string | null | undefined;
  width?: string | number | null | undefined;
  widths?: string | null | undefined;
  wordSpacing?: string | number | null | undefined;
  "word-spacing"?: string | number | null | undefined;
  writingMode?: string | null | undefined;
  "writing-mode"?: string | null | undefined;
  x?: string | number | null | undefined;
  x1?: string | number | null | undefined;
  x2?: string | number | null | undefined;
  xChannelSelector?: string | null | undefined;
  xHeight?: string | number | null | undefined;
  "x-height"?: string | number | null | undefined;
  xlinkActuate?: string | null | undefined;
  "xlink:actuate"?: string | null | undefined;
  xlinkArcrole?: string | null | undefined;
  "xlink:arcrole"?: string | null | undefined;
  xlinkHref?: string | null | undefined;
  "xlink:href"?: string | null | undefined;
  xlinkRole?: string | null | undefined;
  "xlink:role"?: string | null | undefined;
  xlinkShow?: string | null | undefined;
  "xlink:show"?: string | null | undefined;
  xlinkTitle?: string | null | undefined;
  "xlink:title"?: string | null | undefined;
  xlinkType?: string | null | undefined;
  "xlink:type"?: string | null | undefined;
  xmlBase?: string | null | undefined;
  "xml:base"?: string | null | undefined;
  xmlLang?: string | null | undefined;
  "xml:lang"?: string | null | undefined;
  xmlns?: string | null | undefined;
  "xmlns:xlink"?: string | null | undefined;
  xmlSpace?: string | null | undefined;
  "xml:space"?: string | null | undefined;
  y?: string | number | null | undefined;
  y1?: string | number | null | undefined;
  y2?: string | number | null | undefined;
  yChannelSelector?: string | null | undefined;
  z?: string | number | null | undefined;
  zoomAndPan?: string | null | undefined;
};

export type JsxProps = JsxHTMLAttributes & JsxSVGAttributes & {
  [name: string]: unknown;
};

export type JsxAnchorAttributes = JsxHTMLAttributes & {
  download?: boolean | string | null | undefined;
  href?: string | null | undefined;
  hreflang?: string | null | undefined;
  ping?: string | null | undefined;
  referrerpolicy?: JsxReferrerPolicy;
  rel?: string | null | undefined;
  target?: string | null | undefined;
  type?: string | null | undefined;
};

export type JsxButtonAttributes = JsxHTMLAttributes & {
  command?: string | null | undefined;
  commandfor?: string | null | undefined;
  disabled?: boolean | null | undefined;
  form?: string | null | undefined;
  formaction?: string | null | undefined;
  formenctype?: string | null | undefined;
  formmethod?: string | null | undefined;
  formnovalidate?: boolean | null | undefined;
  formtarget?: string | null | undefined;
  name?: string | null | undefined;
  popovertarget?: string | null | undefined;
  popovertargetaction?: "hide" | "show" | "toggle" | null | undefined;
  type?: "button" | "submit" | "reset" | null | undefined;
  value?: string | number | null | undefined;
};

export type JsxInputAttributes = JsxHTMLAttributes & {
  accept?: string | null | undefined;
  alt?: string | null | undefined;
  autocomplete?: string | null | undefined;
  capture?: boolean | "user" | "environment" | null | undefined;
  checked?: boolean | null | undefined;
  dirname?: string | null | undefined;
  disabled?: boolean | null | undefined;
  form?: string | null | undefined;
  formaction?: string | null | undefined;
  formenctype?: string | null | undefined;
  formmethod?: string | null | undefined;
  formnovalidate?: boolean | null | undefined;
  formtarget?: string | null | undefined;
  height?: string | number | null | undefined;
  list?: string | null | undefined;
  max?: string | number | null | undefined;
  maxlength?: string | number | null | undefined;
  min?: string | number | null | undefined;
  minlength?: string | number | null | undefined;
  multiple?: boolean | null | undefined;
  name?: string | null | undefined;
  pattern?: string | null | undefined;
  placeholder?: string | null | undefined;
  readonly?: boolean | null | undefined;
  required?: boolean | null | undefined;
  size?: string | number | null | undefined;
  src?: string | null | undefined;
  step?: string | number | null | undefined;
  type?: string | null | undefined;
  value?: string | number | readonly string[] | null | undefined;
  width?: string | number | null | undefined;
};

export type JsxTextareaAttributes = JsxHTMLAttributes & {
  autocomplete?: string | null | undefined;
  cols?: string | number | null | undefined;
  dirname?: string | null | undefined;
  disabled?: boolean | null | undefined;
  form?: string | null | undefined;
  maxlength?: string | number | null | undefined;
  minlength?: string | number | null | undefined;
  name?: string | null | undefined;
  placeholder?: string | null | undefined;
  readonly?: boolean | null | undefined;
  required?: boolean | null | undefined;
  rows?: string | number | null | undefined;
  value?: string | number | null | undefined;
  wrap?: "hard" | "soft" | "off" | null | undefined;
};

export type JsxSelectAttributes = JsxHTMLAttributes & {
  autocomplete?: string | null | undefined;
  disabled?: boolean | null | undefined;
  form?: string | null | undefined;
  multiple?: boolean | null | undefined;
  name?: string | null | undefined;
  required?: boolean | null | undefined;
  size?: string | number | null | undefined;
  value?: string | number | readonly string[] | null | undefined;
};

export type JsxOptionAttributes = JsxHTMLAttributes & {
  disabled?: boolean | null | undefined;
  label?: string | null | undefined;
  selected?: boolean | null | undefined;
  value?: string | number | null | undefined;
};

export type JsxFormAttributes = JsxHTMLAttributes & {
  acceptcharset?: string | null | undefined;
  action?: string | null | undefined;
  autocomplete?: "on" | "off" | null | undefined;
  enctype?: string | null | undefined;
  method?: "get" | "post" | "dialog" | null | undefined;
  name?: string | null | undefined;
  novalidate?: boolean | null | undefined;
  target?: string | null | undefined;
};

export type JsxLabelAttributes = JsxHTMLAttributes & {
  for?: string | null | undefined;
  form?: string | null | undefined;
};

export type JsxImgAttributes = JsxHTMLAttributes & {
  alt?: string | null | undefined;
  crossorigin?: JsxCrossOrigin;
  decoding?: "async" | "auto" | "sync" | null | undefined;
  fetchpriority?: JsxFetchPriority;
  height?: string | number | null | undefined;
  loading?: "eager" | "lazy" | null | undefined;
  referrerpolicy?: JsxReferrerPolicy;
  sizes?: string | null | undefined;
  src?: string | null | undefined;
  srcset?: string | null | undefined;
  usemap?: string | null | undefined;
  width?: string | number | null | undefined;
};

export type JsxScriptAttributes = JsxHTMLAttributes & {
  async?: boolean | null | undefined;
  blocking?: string | null | undefined;
  crossorigin?: JsxCrossOrigin;
  defer?: boolean | null | undefined;
  fetchpriority?: JsxFetchPriority;
  integrity?: string | null | undefined;
  nomodule?: boolean | null | undefined;
  referrerpolicy?: JsxReferrerPolicy;
  src?: string | null | undefined;
  type?: string | null | undefined;
};

export type JsxLinkAttributes = JsxHTMLAttributes & {
  as?: string | null | undefined;
  crossorigin?: JsxCrossOrigin;
  fetchpriority?: JsxFetchPriority;
  href?: string | null | undefined;
  hreflang?: string | null | undefined;
  imagesizes?: string | null | undefined;
  imagesrcset?: string | null | undefined;
  integrity?: string | null | undefined;
  media?: string | null | undefined;
  referrerpolicy?: JsxReferrerPolicy;
  rel?: string | null | undefined;
  sizes?: string | null | undefined;
  type?: string | null | undefined;
};

export type JsxMetaAttributes = JsxHTMLAttributes & {
  charset?: string | null | undefined;
  content?: string | null | undefined;
  httpEquiv?: string | null | undefined;
  httpequiv?: string | null | undefined;
  media?: string | null | undefined;
  name?: string | null | undefined;
};

export type JsxSourceAttributes = JsxHTMLAttributes & {
  height?: string | number | null | undefined;
  media?: string | null | undefined;
  sizes?: string | null | undefined;
  src?: string | null | undefined;
  srcset?: string | null | undefined;
  type?: string | null | undefined;
  width?: string | number | null | undefined;
};

export type JsxTrackAttributes = JsxHTMLAttributes & {
  default?: boolean | null | undefined;
  kind?: "subtitles" | "captions" | "descriptions" | "chapters" | "metadata" | null | undefined;
  label?: string | null | undefined;
  src?: string | null | undefined;
  srclang?: string | null | undefined;
};

export type JsxMediaAttributes = JsxHTMLAttributes & {
  autoplay?: boolean | null | undefined;
  controls?: boolean | null | undefined;
  controlslist?: string | null | undefined;
  crossorigin?: JsxCrossOrigin;
  disableremoteplayback?: boolean | null | undefined;
  loop?: boolean | null | undefined;
  muted?: boolean | null | undefined;
  playsinline?: boolean | null | undefined;
  poster?: string | null | undefined;
  preload?: "none" | "metadata" | "auto" | "" | null | undefined;
  src?: string | null | undefined;
};

export type JsxIframeAttributes = JsxHTMLAttributes & {
  allow?: string | null | undefined;
  allowfullscreen?: boolean | null | undefined;
  height?: string | number | null | undefined;
  loading?: "eager" | "lazy" | null | undefined;
  name?: string | null | undefined;
  referrerpolicy?: JsxReferrerPolicy;
  sandbox?: string | null | undefined;
  src?: string | null | undefined;
  srcdoc?: string | null | undefined;
  width?: string | number | null | undefined;
};

export type JsxSlotAttributes = JsxHTMLAttributes & {
  name?: string | null | undefined;
};

export type JsxIntrinsicElements = {
  a: JsxAnchorAttributes;
  audio: JsxMediaAttributes;
  button: JsxButtonAttributes;
  form: JsxFormAttributes;
  iframe: JsxIframeAttributes;
  img: JsxImgAttributes;
  input: JsxInputAttributes;
  label: JsxLabelAttributes;
  link: JsxLinkAttributes;
  meta: JsxMetaAttributes;
  option: JsxOptionAttributes;
  script: JsxScriptAttributes;
  select: JsxSelectAttributes;
  slot: JsxSlotAttributes;
  source: JsxSourceAttributes;
  textarea: JsxTextareaAttributes;
  track: JsxTrackAttributes;
  video: JsxMediaAttributes;

  circle: JsxSVGAttributes;
  g: JsxSVGAttributes;
  line: JsxSVGAttributes;
  path: JsxSVGAttributes;
  polygon: JsxSVGAttributes;
  polyline: JsxSVGAttributes;
  rect: JsxSVGAttributes;
  svg: JsxSVGAttributes;

  [name: string]: JsxProps;
};
