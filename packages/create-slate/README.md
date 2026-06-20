# create-slate

Create a new Slate project.

## Usage

```sh
npm create slate@latest my-app
cd my-app
npm install
npm run dev
```

Equivalent direct command:

```sh
npx create-slate my-app
```

Use `--force` to overwrite scaffold files in a non-empty directory:

```sh
npx create-slate my-app --force
```

When `--force` is used, an existing `package.json` is moved to `package.json.old` before the new project manifest is written.

The creator tries to detect your package manager from project files and the current package-manager user agent. Detection priority is Deno, Bun, pnpm, Yarn, then npm. If detection fails, it falls back to npm.

After creating the project, it asks whether to install dependencies. Use `--install` to install without prompting or `--no-install` to skip the prompt.

## What gets created

- `slate.config.ts`
- `deno.json`
- `src/App.slate`
- `src/components/Card.slate`
- `scripts/slate.mjs`
- `public/favicon.svg`
- package scripts for dev, check, build, and preview

Generated projects use JSR packages through npm aliases while source imports remain `@slate/*`.
