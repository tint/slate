# @internal/prepare-publish

Publish staging tool for source packages.

This package is currently internal to the Slate workspace, but it is designed as a general-purpose tool. It prepares publish-ready package directories under `.prepare-publish/` without mutating source package directories.

## Usage

Prepare the current package:

```sh
bun run prepare-publish
```

Prepare a package from the workspace:

```sh
bun run prepare-publish @slate/compiler
```

Prepare every publishable workspace package:

```sh
bun run prepare-publish --all
```

Preview the plan without writing files:

```sh
bun run prepare-publish --dry-run --all
```

Clean the staging root before writing:

```sh
bun run prepare-publish --clean --all
```

Run tests:

```sh
bun run test
```

The test suite uses Vitest for fixture-based regression coverage.

## Configuration

Configuration lives in `package.json` under `preparePublishConfig`.

```json
{
  "preparePublishConfig": {
    "publish": true,
    "target": "jsr",
    "out": ".prepare-publish",
    "workspace": {
      "packages": ["*"],
      "exclude": ["@internal/*"],
      "root": "auto"
    },
    "package": {
      "private": "error"
    },
    "dependencies": {
      "workspace": "rewrite",
      "catalog": "rewrite"
    },
    "metadata": {
      "remove": ["private", "scripts", "devDependencies", "preparePublishConfig"]
    },
    "commands": {
      "before": "bun run build"
    }
  }
}
```

Defaults are used when this field is absent.

`commands.before` may be a string or an array of strings:

```json
{
  "preparePublishConfig": {
    "commands": {
      "before": [
        "bun run build",
        "bun run check"
      ]
    }
  }
}
```

Before commands run in the package directory before publish files are collected. They are skipped during `--dry-run`.

## Behavior

- `prepare-publish` prepares the current package.
- `prepare-publish <name>` resolves a package from the workspace package map.
- `prepare-publish --all` prepares every publishable workspace package.
- `catalog:` dependency ranges are rewritten from the root catalog.
- `workspace:` dependency ranges are rewritten from workspace package versions.
- Source package directories are never mutated.

See `DESIGN.md` for the full design.
