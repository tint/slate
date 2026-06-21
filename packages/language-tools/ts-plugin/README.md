# @slate/ts-plugin

TypeScript server plugin utilities for Slate editor integration.

## Responsibility

- Improve TypeScript support for `.slate` files.
- Provide virtual TypeScript documents for `<script slate>`.
- Preserve source offsets for diagnostics and navigation where possible.
- Provide rune declaration types for `$prop`, `$props`, `$inject`, and `$provide`.
- Provide TypeScript views for template expressions and block scopes.
- Provide virtual component module types for props and slot contracts.

## Current model

The current implementation covers `<script slate>` and template TypeScript islands.

It parses a `.slate` file with `@slate/compiler`, finds the first Slate script block,
and creates a virtual `.slate.ts` document:

- non-script template content becomes whitespace
- original newlines are preserved
- `<script slate>` body text stays at the same offsets
- Slate rune declarations are appended after the original source
- template expressions are appended as generated TypeScript statements
- `{#if ...}` and `{#each ... as item}` create generated control-flow scaffolding
- `slot:name={pattern}` creates a generated binding scope for slot content
- imported Slate component elements create generated props checks
- generated expression ranges map back to the original `.slate` ranges
- rune declarations provide editor type inference
- imported `.slate` modules expose `Component<Props, Slots>` instead of internal helper types

This keeps the important mapping simple:

```ts
original script offset === virtual script offset
```

## Component module typing

For an imported `.slate` file, the plugin creates a virtual `.slate.module.ts` module.

The public shape is:

```ts
export type Props = {};
export type Slots = {};

export type Component<TProps, TSlots> = {
  render(props?: TProps, slots?: TSlots, context?: unknown): Promise<string>;
};

declare const component: Component<Props, Slots>;
export default component;
```

Inference rules:

- Explicit `export type Props` wins over inferred props.
- Explicit `export type Slots` wins over inferred slots.
- `$prop("title", "Untitled")` infers `title?: string`.
- `$prop<number>("count")` infers `count: number`.
- `$props<T>()` intersects `T` into inferred props.
- `<slot name="header" data={{ title, count }} />` infers `header?: (data: { title: typeof title; count: typeof count }) => unknown`.
- `<slot />` infers the default slot with `data?: undefined`.

These types exist only for editor integration and type checking. They do not change the generated runtime render module.

## Public helpers

```ts
createSlateVirtualDocument(source, filename)
toVirtualFilename(filename)
toOriginalFilename(filename)
toVirtualOffset(document, originalOffset)
toOriginalOffset(document, virtualOffset)
```

These helpers are intended to be reusable by the language server later. The TypeScript
plugin is not the only consumer.

## TypeScript server plugin

The default export follows the TypeScript server plugin shape:

```ts
export default function createPlugin(modules) {
  return {
    create(info) {
      return info.languageService;
    },
  };
}
```

During initialization it patches the language service host so `.slate` snapshots are
served as virtual TypeScript content.

## Status

Implemented as a minimal virtual document provider plus tsserver plugin bootstrap.

## Boundary

This package should not parse `.slate` manually. It must continue to use
`@slate/compiler` as the syntax authority.
