# @slate/kit

Public Slate framework package.

## Responsibility

- Provide user-facing Slate APIs.
- Provide runtime helpers used by compiled output.
- Provide render helpers for compiled Slate components.
- Expose stable integration surfaces for frameworks and bundlers.

## Status

This package is currently a scaffold. It contains initial slot helper types and utilities.

## Boundary

`@slate/kit` should not own compiler behavior. Compiler logic belongs in `@slate/compiler`.
