# @slate/kit

Public Slate framework package.

## Responsibility

- Provide user-facing Slate APIs.
- Provide runtime helpers used by compiled output.
- Provide render helpers for compiled Slate components.
- Expose stable integration surfaces for frameworks and bundlers.

## Status

This package provides the runtime contract used by compiled Slate output.

## Render contract

Slate components and slots return `RenderResult` instead of plain strings:

```ts
import type { RenderFunction, RenderResult, RenderValue, SlateHTML } from "@slate/kit";
```

Core types:

```ts
type SlateHTML = {
  readonly value: string;
};

type RenderValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | SlateHTML
  | readonly RenderValue[]
  | Promise<
      | string
      | number
      | bigint
      | boolean
      | null
      | undefined
      | SlateHTML
      | readonly RenderValue[]
    >;

type RenderResult = SlateHTML | Promise<SlateHTML>;

type RenderFunction<TInput = void> =
  [TInput] extends [void]
    ? () => RenderResult
    : (input: TInput) => RenderResult;
```

`SlateHTML` is branded at runtime with `SLATE_HTML`, a Slate-owned symbol.

Normal `{expression}` interpolation uses `renderValue()`:

- `SlateHTML` is inserted without escaping.
- arrays are recursively rendered and concatenated without separators.
- strings, numbers, and bigints are escaped.
- `null`, `undefined`, `true`, and `false` render as empty output.

Explicit `{@html expression}` uses `renderHTML()`:

- `SlateHTML` is inserted as-is.
- strings are inserted as raw HTML.
- `null`, `undefined`, `true`, and `false` render as empty output.

## Slots

Slots are render functions:

```ts
type SlotFn<T = unknown> = (data?: T) => RenderResult;
type Slots = Record<string, SlotFn | undefined>;
```

`renderSlot()` returns branded `SlateHTML`, so slot output can pass through
normal `{expression}` without being escaped.

Compile-time `$slot` runes return render functions:

```slate
<script slate>
const children = $slot("default");
const header = $slot<{ title: string }>("header");
const footer = $slot("footer", { text: "Fallback" });
</script>

{children()}
{header({ title: "Hello" })}
{footer()}
```

The default slot is named explicitly with `"default"`. `$slot()` without a name
is not supported.

## Attributes

Compiled expression attributes use `serializeAttribute()`:

- `null` and `undefined` remove the attribute.
- `true` on known boolean attributes emits the bare attribute.
- `false` on known boolean attributes removes the attribute.
- `aria-*` and `data-*` booleans are serialized as `"true"` or `"false"`.
- boolean-like enumerated attributes such as `contenteditable`, `draggable`,
  and `spellcheck` are serialized as `"true"` or `"false"`.
- `translate` booleans are serialized as `"yes"` or `"no"`.
- `true` on normal attributes emits `"true"`.
- `false` on normal attributes removes the attribute.
- `class=` and `style=` keep their dedicated serializers before attribute serialization.

## JSX runtime

`<script slate>` supports TSX through Slate's own JSX runtime. JSX expressions
produce branded `SlateHTML`, so they can be inserted through normal
`{expression}` interpolation without escaping the generated HTML structure.

```slate
<script slate>
const icon = <strong class="mark">Ready</strong>;
</script>

<p>{icon}</p>
```

JSX is for compile-time HTML composition only. Runtime event handler attributes
such as `onClick` are rejected because Slate does not attach browser-side event
listeners from compile-time JSX.

Imported `.slate` components can be used from JSX. JSX children are passed to
the component as its default slot:

```slate
<script slate>
import Card from "./Card.slate";

const card = <Card title="Hello"><p>Body</p></Card>;
</script>

{card}
```

TSX-defined functions or objects are not Slate components. Components must be
`.slate` files imported into `<script slate>`.

Named slots use a `slots` prop:

```slate
<script slate>
import Card from "./Card.slate";

const card = (
  <Card
    slots={{
      header: () => <h1>Header</h1>,
      footer: ({ year }) => <small>{year}</small>,
    }}
  >
    <p>Body</p>
  </Card>
);
</script>
```

`slots.default` and JSX children are mutually exclusive.

## Boundary

`@slate/kit` should not own compiler behavior. Compiler logic belongs in `@slate/compiler`.
