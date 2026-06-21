# Slate Design

## Introduction

### Overview

Slate is a compile-time component renderer.

Slate uses `.slate` files as both components and pages. A `.slate` file is a template from top to bottom. The only block with special compile-time code semantics is `<script slate>`.

```slate
<script slate>
  const name: string = "Slate";
</script>

<div>{name}</div>
```

`<script slate>` is TypeScript-only. It is parsed, transformed, and executed at compile time. It is never emitted to the final HTML.

Normal `<script>` and `<style>` tags are ordinary template content:

```slate
<script type="module">
  console.log("browser script");
</script>

<style>
  body {
    margin: 0;
  }
</style>
```

Slate does not parse template syntax inside normal `<script>` or `<style>` blocks. This keeps native editor tooling, syntax highlighting, and language server behavior intact.

### Getting started

A minimal `.slate` file:

```slate
<script slate>
  const name: string = "sss";
</script>

<div>{name}</div>
```

Compile-time output:

```html
<div>sss</div>
```

A component example:

```slate
<script slate>
  import Card from "./Card.slate";

  const title: string = "Hello";
</script>

<Card>
  <h1 slot:title>{title}</h1>
  <p>Content</p>
</Card>
```

### `.slate` files

Rules:

- The entire file is a template.
- A file may contain zero or more top-level template nodes.
- A single root element is not required.
- Any HTML tag, custom element, or Web Component tag may be written.
- Slate components are identified by imports from `<script slate>`, not by tag casing.
- `<script slate>` is compile-time TypeScript.
- Normal `<script>` is emitted as browser script content.
- Normal `<style>` is emitted as style content.
- Template syntax is not parsed inside normal `<script>` or `<style>`.

Example:

```slate
<script slate>
  import Button from "./Button.slate";
</script>

<Button>Slate component</Button>

<MyNativeElement>
  Native custom element
</MyNativeElement>

<script type="module">
  console.log("native browser code");
</script>

<style>
  .title {
    color: red;
  }
</style>
```

In this example, `Button` is a Slate component because it is imported from `<script slate>`. `MyNativeElement` is ordinary markup unless it is also imported as a Slate component.

## Compile-time script

`<script slate>` is Slate's compile-time code block.

```slate
<script slate>
  import Card from "./Card.slate";

  type User = {
    name: string;
  };

  const user: User = {
    name: "Slate",
  };
</script>

<Card>
  <p>{user.name}</p>
</Card>
```

Rules:

- Only TypeScript mode is supported.
- JavaScript mode is not supported.
- Plain JavaScript syntax is accepted only when it is valid TypeScript.
- ESM `import` and `export` are supported.
- Only TypeScript type exports are allowed from `<script slate>`.
- TypeScript types, interfaces, generics, and annotations are supported.
- JSX is not supported unless a future version explicitly enables it.
- The code runs at compile time.
- The block is not emitted to final HTML.
- Template syntax is not parsed inside the block.

Exports are intentionally limited to TypeScript types for type-system friendliness. Runtime value exports are not allowed from `<script slate>`.

```slate
<script slate>
  export type CardVariant = "default" | "featured";

  export interface CardProps {
    title?: string;
    variant?: CardVariant;
  }

  const props = $props<CardProps>({
    title: "Untitled",
    variant: "default",
  });
</script>

<section class={["card", `card-${props.variant}`]}>
  <h1>{props.title}</h1>
  <slot />
</section>
```

Compiled module shape:

```ts
export type CardVariant = "default" | "featured";
export interface CardProps {
  title?: string;
  variant?: CardVariant;
}
export async function render(props, slots, context) {
  return html;
}
```

Allowed exports:

```ts
export type ButtonSize = "sm" | "md" | "lg";
export interface ButtonProps {
  size?: ButtonSize;
}
export type { Theme } from "./theme";
```

Disallowed exports:

```ts
export const prerender = true;
export function helper() {}
export class Model {}
```

Rules:

- `export type` is allowed.
- `export interface` is allowed.
- Type-only re-exports are allowed.
- Runtime value exports are compile errors.
- Component metadata must use a future dedicated API instead of value exports.

## Component model

Each `.slate` file compiles to an ESM module with a render function.

```ts
export async function render(props, slots, context) {
  return html;
}
```

Components are imported from `<script slate>`:

```slate
<script slate>
  import Card from "./Card.slate";
</script>

<Card />
```

Tags that are not imported are emitted as normal markup:

```slate
<Unknown />
```

Output:

```html
<Unknown></Unknown>
```

Component props use HTML attribute syntax:

```slate
<Card title="Hello" count={count} disabled />
```

If a component exports a `Props` type, callers are checked against that type:

```slate
<script slate>
  export interface Props {
    title: string;
    count?: number;
  }
</script>
```

Compiled props:

```ts
{
  title: "Hello",
  count,
  disabled: true,
}
```

## Runes

Runes are compile-time APIs available inside `<script slate>`.

Runes are not template syntax. They are TypeScript functions recognized by the Slate compiler.

### `$prop`

Declares a single component prop.

```slate
<script slate>
  const title = $prop<string>("title", "Untitled");
</script>

<h1>{title}</h1>
```

Rules:

- The first argument is the prop name.
- The optional second argument is the default value.
- The returned value is available to the template.
- Type parameters provide TypeScript type information.

### `$props`

Declares multiple component props.

```slate
<script slate>
  const props = $props<{
    title?: string;
    count?: number;
  }>({
    title: "Untitled",
    count: 0,
  });
</script>

<h1>{props.title}</h1>
<p>{props.count}</p>
```

Rules:

- `$props<T>()` returns a typed props object.
- An optional defaults object may be provided.
- Defaults are applied when the caller does not provide a prop.

### `$slot`

Declares a slot render function.

```slate
<script slate>
  const children = $slot("default");
  const header = $slot<{ title: string }>("header");
  const footer = $slot("footer", { text: "Fallback footer" });
</script>

<section>
  <header>{header({ title: "Hello" })}</header>
  <main>{children()}</main>
  <footer>{footer()}</footer>
</section>
```

Rules:

- `$slot` must be assigned to a top-level `const` identifier.
- `$slot` requires a static string slot name.
- The default slot must be declared as `$slot("default")`.
- `$slot()` with no name is not supported.
- `$slot<T>("name")` returns a render function that requires `data: T`.
- `$slot<T>("name", defaultData)` returns a render function with optional data.
- `$slot("name", defaultData)` infers data from `defaultData`.
- The render function returns `RenderResult`, so `{slot(data)}` inserts rendered HTML without escaping.

### `$provide`

Provides a context value to descendant Slate components.

```slate
<script slate>
  $provide("theme", {
    color: "red",
    spacing: 8,
  });
</script>

<slot />
```

Rules:

- `$provide(key, value)` stores data in the current render context.
- Descendant Slate components may read the value with `$inject`.
- Keys may be strings or symbols.
- Values are shared by reference.
- Functions, class instances, and other non-serializable values are allowed.
- Mutating a provided object through an injected reference mutates the shared context value.

### `$inject`

Injects a context value from an ancestor provider.

```slate
<script slate>
  const theme = $inject<{
    color: string;
    spacing: number;
  }>("theme", {
    color: "black",
    spacing: 0,
  });
</script>

<div style={{ color: theme.color }}>
  <slot />
</div>
```

Rules:

- `$inject(key)` reads data from the nearest ancestor provider.
- `$inject(key, fallback)` returns the fallback when no provider exists.
- Injected values are returned by reference.
- Fallback values are returned as-is.

### Context value model

`$provide` and `$inject` intentionally use reference semantics.

This keeps context useful for advanced compile-time integrations, such as:

- shared registries
- functions
- class instances
- memoized services
- compiler or framework adapters

Rules:

- Context values are not serialized.
- Context values are not cloned.
- Slate does not protect callers from shared mutable state.
- Component authors should treat context as an explicit shared channel, not as props.
- User-facing component data should still prefer `$prop`, `$props`, and slots.

## Render type system

Slate render output uses an explicit HTML boundary instead of treating every
rendered value as a plain string.

Core types:

```ts
export const SLATE_HTML = Symbol.for("slate.html");

export type SlateHTML = {
  readonly value: string;
};

export type RenderPrimitive =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined;

export type RenderValue =
  | RenderPrimitive
  | SlateHTML
  | Promise<RenderValue>;

export type RenderResult = SlateHTML | Promise<SlateHTML>;

export type RenderFunction<TInput = void> =
  [TInput] extends [void]
    ? () => RenderResult
    : (input: TInput) => RenderResult;
```

Rules:

- Components return `RenderResult`.
- Slot functions return `RenderResult`.
- Normal `{expression}` uses `renderValue(expression)`.
- `renderValue` escapes strings, numbers, and bigints.
- `renderValue` inserts `SlateHTML` without escaping.
- `renderValue` renders `null`, `undefined`, `true`, and `false` as empty output.
- `{@html expression}` uses `renderHTML(expression)`.
- `renderHTML` inserts strings as raw HTML.
- `renderHTML` inserts `SlateHTML` without unwrapping through string coercion.
- `renderHTML` renders `null`, `undefined`, `true`, and `false` as empty output.

`SlateHTML` is runtime-branded with `SLATE_HTML`. The brand is a Slate-owned
symbol, not `Symbol.toStringTag`; `Symbol.toStringTag` is display metadata and
must not be used as the safety boundary.

HTML attributes use attribute-specific rendering:

- `null` and `undefined` remove expression attributes.
- `true` on known boolean attributes emits the bare attribute.
- `false` on known boolean attributes removes the attribute.
- booleans on `aria-*` attributes are serialized as `"true"` or `"false"`.
- booleans on `data-*` attributes are serialized as `"true"` or `"false"`.
- booleans on boolean-like enumerated attributes such as `contenteditable`,
  `draggable`, and `spellcheck` are serialized as `"true"` or `"false"`.
- booleans on `translate` are serialized as `"yes"` or `"no"`.
- `true` on normal attributes emits `"true"`.
- `false` on normal attributes removes the attribute.
- `class=` and `style=` keep their dedicated serializers.

This model exists so component results, slot results, and future render runes
can pass through `{expression}` without accidentally escaping already-rendered
HTML.

## Template syntax

### `{expression}`

Expression interpolation renders an escaped value.

```slate
<p>{name}</p>
```

Rules:

- Expressions are evaluated in the current template scope.
- Output is HTML-escaped by default.
- Expressions are not parsed inside normal `<script>` or `<style>`.

### `{#if ...}`

Conditional rendering:

```slate
{#if user}
  <p>Hello {user.name}</p>
{:else}
  <p>Hello guest</p>
{/if}
```

`else if` is supported:

```slate
{#if status === "loading"}
  <p>Loading</p>
{:else if status === "error"}
  <p>Error</p>
{:else}
  <p>Done</p>
{/if}
```

Rules:

- The condition is a TypeScript expression.
- The selected branch is rendered at compile time.
- No extra HTML wrapper is produced.

### `{#each ...}`

List rendering:

```slate
<ul>
  {#each items as item}
    <li>{item}</li>
  {/each}
</ul>
```

Index binding:

```slate
{#each items as item, index}
  <p>{index}: {item}</p>
{/each}
```

Fallback branch:

```slate
{#each items as item}
  <p>{item}</p>
{:else}
  <p>No items</p>
{/each}
```

Rules:

- The source expression must be iterable or array-like.
- The item binding is scoped to the block.
- The optional index binding is scoped to the block.
- The `{:else}` branch renders when the source has no items.

### `{#await ...}`

Async rendering:

```slate
{#await getPost()}
  <p>Loading</p>
{:then post}
  <h1>{post.title}</h1>
{:catch error}
  <p>{error.message}</p>
{/await}
```

Rules:

- The expression is awaited at compile time.
- The `{:then}` branch renders when the promise resolves.
- The `{:catch}` branch renders when the promise rejects.
- The pending branch is only meaningful for future streaming or progressive rendering modes.
- Static builds emit the final resolved or rejected branch.

### `{@html ...}`

Raw HTML rendering:

```slate
{@html content}
```

Rules:

- The expression is evaluated and inserted without HTML escaping.
- The user is responsible for safety.
- Slate does not sanitize raw HTML.

### `{@debug ...}`

Compile-time debugging:

```slate
{@debug user}
```

Rules:

- Expressions are evaluated at compile time.
- Values are printed in development or debug mode.
- No HTML is emitted.
- Production builds may remove debug statements or warn on them.

### `{let/const ...}`

Template-local declarations:

```slate
{const title = post.title.toUpperCase()}

<h1>{title}</h1>
```

Mutable local declarations are also allowed:

```slate
{let count = items.length}

<p>{count}</p>
```

Rules:

- Declarations are scoped to the current template block.
- Declarations emit no HTML.
- Complex logic should usually live in `<script slate>`.

### `is:`

`is:` is Slate's compiler directive namespace.

In Slate, these directives are about build output and tree shaking, not CSS scoping.

#### `is:global`

Marks a normal `<script>` or `<style>` block as shared page-level output.

```slate
<style is:global>
  body {
    margin: 0;
  }
</style>
```

```slate
<script is:global="head">
  document.documentElement.dataset.theme = localStorage.theme || "light";
</script>
```

```slate
<script is:global>
  window.__SLATE_READY__ = true;
</script>
```

Rules:

- `is:global` may apply only to normal inline `<script>` and `<style>` blocks.
- `is:global` must not apply to `<script slate>`.
- `is:global` must not apply to `<script src="...">`.
- `is:global` and `is:inline` are mutually exclusive.
- `<style is:global>` must not have a value.
- `<style is:global>` is extracted and injected once before `</head>`.
- `<script is:global="head">` is extracted and injected once before `</head>`.
- `<script is:global="tail">` is extracted and injected once before `</body>`.
- `<script is:global>` is equivalent to `<script is:global="tail">`.
- `<script is:global="...">` only accepts `head` or `tail`.
- Global blocks are deduplicated by their generated output and injection position.
- If no `<head>` exists, head assets are prepended to the document.
- If no `</body>` exists, tail assets are appended to the document.

#### `is:inline`

Marks a normal `<script>` or `<style>` block as per-instance inline output.

```slate
<style is:inline>
  .card {
    color: red;
  }
</style>
```

```slate
<script is:inline>
  console.log("inline browser script");
</script>
```

Rules:

- `is:inline` may apply to normal `<script>` and `<style>`.
- `is:inline` must not apply to `<script slate>`.
- `is:inline` must not apply to `<script src="...">`.
- `is:inline` must not have a value.
- `is:global` and `is:inline` are mutually exclusive.
- The block is emitted at its template location.
- The block is emitted every time the component instance is rendered.
- The block is not promoted into a shared page-level asset and is not deduplicated.

### `dev:`

`dev:` is Slate's development-only directive namespace.

Development directives are never emitted in production build output. They exist
to improve local DX without becoming part of the public HTML contract.

#### `dev:scroll`

Marks a scroll container whose position should be restored after a development
full reload.

```slate
<aside dev:scroll="sidebar">
  ...
</aside>
```

Rules:

- `dev:scroll` may apply only to normal template elements.
- `dev:scroll` must use a static string value.
- `dev:scroll` without a value is invalid.
- `dev:scroll={expr}` is invalid.
- The string value must be stable across template edits.
- In dev output, `dev:scroll="sidebar"` becomes `data-slate-dev-scroll="sidebar"`.
- In production build output, `dev:*` directives are stripped.

Slate intentionally keeps full page reload as the default dev update strategy.
The current runtime renders HTML at compile/build time and does not maintain a
browser-side component instance tree. DOM diffing or component-level patching
would risk deleting user-managed DOM, third-party widget output, canvas/chart
state, editor state, and event listener ownership. Full reload preserves
correctness; `dev:scroll` recovers the most common lost state without pretending
Slate owns arbitrary browser-side DOM.

### `Fragment`

`Fragment` groups multiple nodes without producing a wrapper element.

```slate
<Fragment>
  <h1>Hello</h1>
  <p>World</p>
</Fragment>
```

Rules:

- `Fragment` is built in and does not need to be imported.
- `Fragment` does not emit a real element.
- `Fragment` can be used in slots, conditionals, and loops.

Named slot example:

```slate
<Card>
  <Fragment slot:title>
    <h1>Hello</h1>
    <p>Subtitle</p>
  </Fragment>
</Card>
```

### `slots`

Slate uses native `<slot>` tags and `slot` attributes for slots.

Component definition:

```slate
<section>
  <header>
    <slot name="title">Default title</slot>
  </header>

  <main>
    <slot />
  </main>
</section>
```

Component usage:

```slate
<Card>
  <h1 slot:title>Hello</h1>
  <p>Main content</p>
</Card>
```

Rules:

- `<slot />` is the default slot outlet.
- `<slot name="title" />` is a named slot outlet.
- `<slot name="title" data={value} />` passes data to the slot content.
- `slot:title` assigns a child node to a named slot.
- `slot:title={pattern}` assigns a child node to a named slot and binds slot data.
- Children without `slot` are assigned to the default slot.
- `<slot>fallback</slot>` defines fallback content.
- Slot content is evaluated in the parent component scope.
- Slot data is provided by the child component and bound by the parent slot content.
- Slot placement is controlled by the child component.
- Slate does not use `slot="name"` for component slot assignment.
- Native `slot:name` inside non-Slate custom elements is preserved as normal markup.

Slot data example:

```slate
<slot name="header" data={{ title, icon, tail }} />
```

The parent can bind that data with `slot:header={pattern}`:

```slate
<Card>
  <header slot:header={{ title, icon, tail }}>
    {icon}
    <h1>{title}</h1>
    {tail}
  </header>
</Card>
```

For `slot:name={pattern}`, the right-hand side is a binding pattern, not a normal expression. In the example above, `title`, `icon`, and `tail` are introduced into the slot content scope from the child component's slot data.

Type contract:

- A child component's `<slot name="header" data={value} />` defines the data shape for the `header` slot.
- A parent component's `slot:header={pattern}` is checked against that child slot data shape.
- Unknown slot names are type errors when the child component exposes a static slot contract.
- If a slot outlet has no `data`, the parent may still provide slot content, but there is no data pattern to bind.
- Slot data expressions that depend on compile-time script values keep their TypeScript types when the component is imported by another `.slate` file.

Compiled slot model:

```ts
await renderSlot(slots, "header", fallback, {
  title,
  icon,
  tail,
});
```

Parent slot function:

```ts
header: async ({ title, icon, tail }) => {
  return html;
}
```

- Slot data is passed by reference.
- Functions, classes, class instances, closures, and other non-serializable values are allowed.
- Mutating bound slot data may mutate the child component source value.
- `slot:name` is only interpreted inside Slate component children.
- Outside a Slate component boundary, `slot:name` is emitted as a normal attribute unless a future HTML compatibility rule forbids it.

Native Web Component example:

```slate
<my-web-component>
  <span slot:title>Native slot</span>
</my-web-component>
```

If `my-web-component` is not imported as a Slate component, native `slot:title` is emitted unchanged.

Slate component example:

```slate
<script slate>
  import Card from "./Card.slate";
</script>

<Card>
  <span slot:title>Slate slot</span>
</Card>
```

In this case, `slot:title` is consumed as a Slate slot assignment.

### `class=`

`class` supports clsx-style values.

String:

```slate
<div class="card active" />
```

Expression:

```slate
<div class={className} />
```

Array:

```slate
<div class={["card", active && "active"]} />
```

Object:

```slate
<div class={{ card: true, active, disabled: false }} />
```

Mixed values:

```slate
<div class={["card", { active, disabled }, extraClass]} />
```

Rules:

- Strings are included as-is.
- Falsy values are ignored.
- Arrays are flattened recursively.
- Object keys are class names.
- Object values control whether the key is included.
- The final output is a normal HTML `class` string.

### `style=`

`style` supports `string | object | Array<string | object>`.

String:

```slate
<div style="color: red; margin-top: 8px;" />
```

Object:

```slate
<div style={{ color: "red", marginTop: "8px" }} />
```

Array:

```slate
<div style={[
  "color: red",
  { marginTop: "8px", display: visible ? "block" : "none" }
]} />
```

Rules:

- Strings are included as-is.
- Objects are converted to CSS declarations.
- Object keys may be camelCase or kebab-case.
- Arrays are flattened recursively.
- Falsy values are ignored.
- Numeric values are stringified as-is.
- Slate does not automatically append `px`.
- The final output is a normal HTML `style` string.

## MVP scope

Initial implementation should support:

- `.slate` file parsing.
- `<script slate>` TypeScript compile-time execution.
- Normal HTML and custom element output.
- Component imports and component calls.
- Attribute props.
- `{expression}`.
- `{#if}`.
- `{#each}`.
- `{@html ...}`.
- Native `<slot>` and `slot:name`.
- `Fragment`.
- `class=` clsx-style serialization.
- `style=` string/object/array serialization.
- `$prop`.
- `$props`.
- `$provide`.
- `$inject`.
- Normal `<script>` and `<style>` passthrough.
- `is:global` and `is:inline` for normal inline `<script>` and `<style>`.
- `dev:scroll` in development output.

Initial implementation may reserve or partially support:

- `{#await}`.
- `{@debug ...}`.
- `{let/const ...}`.

Initial implementation should not support:

- Hydration.
- Client runtime.
- Browser-side reactivity.
- Scoped CSS.
- Source maps.
- Incremental build cache.
- Streaming render.
