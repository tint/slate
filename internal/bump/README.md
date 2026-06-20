# @internal/bump

Interactive workspace version bump helper for Slate packages.

It updates package versions, package changelogs, `jsr.json` versions, and internal workspace dependency ranges. It does not publish packages.

```bash
bun run bump
```

## Supported packages

- root workspace package
- `packages/*`
- `packages/language-tools/*`
- `internal/*`

## Preconditions

- The workspace root must be the git repository root.
- The selected package path must not contain uncommitted changes.

These checks run before a package can be bumped. The changelog is generated from committed git history, so dirty package files are rejected.

## Flow

The command processes one package at a time:

- select a package
- review package-specific git changelog entries
- select a base version
- select a release channel
- confirm the bump plan
- choose whether to bump another package

## Base version

The base version is selected before the release channel:

- `current` keeps the current major/minor/patch base and drops any prerelease suffix
- `patch` increments the patch base
- `minor` increments the minor base
- `major` increments the major base

## Release channel

Supported channels:

- `stable`
- `alpha`
- `beta`
- `rc`
- `custom`
- `skip`

`stable` writes the base version directly.

Prerelease channels append and increment a numeric suffix starting at `.1`:

```txt
0.1.0 + current + alpha -> 0.1.0-alpha.1
0.1.0-alpha.1 + current + alpha -> 0.1.0-alpha.2
0.1.0-alpha.1 + current + beta -> 0.1.0-beta.1
0.1.0-rc.1 + current + stable -> 0.1.0
0.1.0 + minor + beta -> 0.2.0-beta.1
```

## Changelog source

Changelog entries come from git commit subjects scoped to the selected package path.

For package workspaces, the command reads commits that touched that package directory.

For the root workspace package, the command reads commits from the repository root while excluding `packages/` and `internal/`.

If a package version tag exists, only commits after that tag are collected. Supported tag forms include:

```txt
@slate/compiler@0.1.0
@slate/compiler@v0.1.0
slate-compiler@0.1.0
slate-compiler@v0.1.0
```

## Files updated

- `package.json`
- `jsr.json`, when present
- `CHANGELOG.md`
- workspace package dependency ranges that reference bumped packages
