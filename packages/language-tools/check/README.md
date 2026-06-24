# @slate/check

Static checker for Slate files.

## Responsibility

- Validate `.slate` files.
- Produce diagnostics from the compiler pipeline (`parse` + `analyze` + generate validation).
- Produce TypeScript diagnostics for `<script slate>` through the shared virtual document model.
- Validate template expressions through the shared virtual document model.
- Validate component props and slot syntax rules.
- Validate imported component props when the component exports a `Props` type.
- Validate rune usage.
- Validate compiler directives.
- Validate project-configured template attribute diagnostics.

## Status

Implemented. Reused by CLI `slate check` and `@slate/language-server`.

## Boundary

`@slate/check` should reuse parser and analysis primitives from `@slate/compiler`.

## API

```ts
export type AttributeDiagnosticRule = {
  pattern: string | RegExp;
  severity?: "warning" | "error" | "off";
  message?: string;
};

export function normalizeAttributeDiagnosticRules(value: unknown): AttributeDiagnosticRule[];

export type CheckFilesOptions = {
  entry: string;
  attributeDiagnostics?: AttributeDiagnosticRule[];
};
export type CheckFilesResult = {
  diagnostics: Diagnostic[];
  sources: Record<string, string>;
};

export function checkFiles(options: CheckFilesOptions): Promise<CheckFilesResult>;

export type CheckSourceOptions = {
  source: string;
  filename: string;
  attributeDiagnostics?: AttributeDiagnosticRule[];
};

export type CheckSourceResult = {
  diagnostics: Diagnostic[];
  sources: Record<string, string>;
};

export function checkSource(options: CheckSourceOptions): CheckSourceResult;
```

## Notes

- `check` is a pure analysis phase: it does not emit HTML.
- `<script slate>` and template expression diagnostics use `@slate/ts-plugin` virtual documents so CLI and editor tooling share the same TypeScript view.
- Slot checks currently cover deprecated `slot="name"`, malformed `slot:name`, `<slot>` outlet `name`/`data` attribute forms, and accidental `slot:*` use on `<slot>` outlets.
- Component prop checks read imported `.slate` modules, preserve their type declarations, and type-check component attributes against an exported `Props` type when present.
- Attribute diagnostics are opt-in and match ordinary template attributes and JSX attributes by raw source name, so rules can distinguish `className` from `class`.
- Attribute diagnostic rules are normalized at runtime. Invalid entries are ignored, missing severity defaults to `"warning"`, and `"off"` keeps a rule disabled.
