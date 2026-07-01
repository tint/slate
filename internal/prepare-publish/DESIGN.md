# Prepare Publish 设计文档

## 1. 目标

`@internal/prepare-publish` 是一个通用的发布准备工具，目前先在 Slate workspace 内部孵化。

它不负责发布包，只负责把源码包准备成一个可检查、可发布的 staging 目录。

默认输出：

```txt
.prepare-publish/
  @slate__compiler/
  @slate__kit/
  @slate__vite/
```

核心目标：

- 不修改源码包目录。
- 支持单包项目。
- 支持 monorepo / workspace 项目。
- 将 `catalog:` 和 `workspace:` 转成发布态版本范围。
- 清理发布时不应该存在的 package metadata。
- 使用 npm 官方 pack 规则复制真实发布文件。
- 生成 staging 后，由用户手动执行 `jsr publish --dry-run` 或未来的 publish 命令。

## 2. 非目标

这些能力不属于 `prepare-publish` 的核心职责：

- 不做 version bump。
- 不生成 changelog。
- 不分析 git changed packages。
- 不做交互式 TUI。
- 不替代 release / bump 工具。
- 不决定包的新版本号。
- 不决定哪些 git commit 应该进入 changelog。

这些能力可以作为后续扩展，但不进入第一版：

- 自动执行 `jsr publish`。
- 自动执行 `npm publish`。
- npm `src -> dist` exports 重写。

## 3. 用户模型

工具区分两个概念：

```txt
当前包 target
workspace package set
```

默认命令永远准备当前目录所属 package。

只有传入 package name 或 `--all` 时，才进入 workspace 包选择语义。

这可以避免 workspace root 本身也是发布包时产生歧义。

### 3.1 准备当前包

```sh
bun run prepare-publish
```

语义：准备当前目录所属 package。

如果当前目录是 workspace root，且 root package 是可发布包，则准备 root package。

如果当前目录是 workspace 子包，则准备该子包。

如果当前目录不是 package 目录，向上查找最近的 `package.json` 作为当前包。

### 3.2 准备 workspace 指定包

```sh
bun run prepare-publish @slate/compiler
```

语义：从 workspace package map 中寻找指定包。

这需要能找到 workspace root。

workspace root package 如果有 `name`，也应该加入 package map。

### 3.3 准备 workspace 全部包

```sh
bun run prepare-publish --all
```

语义：准备 workspace 中所有可发布包。

是否包含 workspace root package，由配置决定。

默认是 `auto`：root package 可发布时包含，不可发布时跳过。

### 3.4 dry-run

```sh
bun run prepare-publish --dry-run
bun run prepare-publish --dry-run @slate/compiler
bun run prepare-publish --dry-run --all
```

语义：只打印计划和 validation 结果，不写 staging 文件。

### 3.5 清理输出

```sh
bun run prepare-publish --clean --all
```

语义：写入前删除 staging root。

### 3.6 覆盖输出目录

```sh
bun run prepare-publish --out .publish @slate/compiler
```

语义：覆盖配置中的输出目录。

## 4. 配置入口

工具只读取 `package.json` 顶层字段：

```json
{
  "preparePublishConfig": {}
}
```

不使用 `publishConfig` 承载本工具配置。

原因：

- `publishConfig` 是 npm 官方字段。
- `publishConfig` 用于 publish-time npm config，例如 `registry`、`access`、`tag`、`provenance`。
- npm 的 `publishConfig` 不是封闭 schema，未来可能增加字段。
- 本工具配置包含 workspace 选择、staging 输出、依赖协议重写、metadata 转换和 JSR/npm target，已经超出 npm `publishConfig` 语义。

### 4.1 配置示例

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
      "remove": ["private", "scripts", "devDependencies"]
    },
    "commands": {
      "before": "bun run build"
    }
  }
}
```

### 4.2 默认配置

```ts
const defaultPreparePublishConfig = {
  publish: true,
  target: "jsr",
  out: ".prepare-publish",
  workspace: {
    packages: ["*"],
    exclude: ["@internal/*"],
    root: "auto",
  },
  package: {
    private: "error",
  },
  dependencies: {
    workspace: "rewrite",
    catalog: "rewrite",
  },
  metadata: {
    remove: ["private", "scripts", "devDependencies"],
  },
  commands: {
    before: [],
  },
};
```

### 4.3 配置合并顺序

```txt
defaults
  -> workspace root package.json preparePublishConfig
  -> target package package.json preparePublishConfig
  -> CLI flags
```

后面的配置覆盖前面的配置。

CLI flags 只覆盖运行时选项，例如 `--out`、`--dry-run`、`--clean`、`--target`。

`commands.before` 支持字符串或字符串数组。命令在 target package 目录执行，发生在文件列表收集和 staging 之前。

`--dry-run` 不执行 `commands.before`，避免 dry-run 产生构建文件、修改源码目录或触发其它副作用。

## 5. 可发布包判断

一个 package 默认可发布，需要满足：

```txt
preparePublishConfig.publish !== false
private !== true
name 存在
version 存在
```

`publish` 默认是 `true`。

如果包设置：

```json
{
  "preparePublishConfig": {
    "publish": false
  }
}
```

则：

- `--all` 跳过该包。
- 显式指定该包时报错。

第一版不提供 `--include-unpublished`。

### 5.1 private 包

默认策略：

```json
{
  "package": {
    "private": "error"
  }
}
```

如果 target package 是 `private: true`，则报错。

未来可以支持：

```json
{
  "package": {
    "private": "allow"
  }
}
```

第一版可以先实现 `error`。

### 5.2 workspace root package

workspace root package 可以是可发布包。

`--all` 是否包含 root package 由：

```json
{
  "workspace": {
    "root": "auto"
  }
}
```

决定。

可选值：

```txt
auto
include
exclude
```

含义：

- `auto`：root package 可发布时包含。
- `include`：强制纳入 root package，若不可发布则报错。
- `exclude`：永远不纳入 root package。

## 6. Workspace 支持

工具需要支持 npm、yarn、pnpm、bun 的 workspace 形态，避免和单一包管理器绑定。

### 6.1 Workspace root 发现

从当前目录向上查找 workspace root。

满足任一条件即可：

- `package.json` 存在且有 `workspaces` 字段。
- `pnpm-workspace.yaml` 存在。

只有 workspace 语义命令需要 workspace root：

```txt
prepare-publish <package-name>
prepare-publish --all
```

默认命令 `prepare-publish` 不要求 workspace root，只要求能找到当前 package。

### 6.2 包管理器检测

包管理器检测只用于日志和提示。

检测优先级：

```txt
pnpm-lock.yaml      -> pnpm
bun.lock            -> bun
bun.lockb           -> bun
yarn.lock           -> yarn
package-lock.json   -> npm
otherwise           -> unknown
```

### 6.3 npm / yarn / bun

读取 workspace root `package.json`：

```json
{
  "workspaces": ["packages/*"]
}
```

也支持：

```json
{
  "workspaces": {
    "packages": ["packages/*"]
  }
}
```

### 6.4 pnpm

优先读取：

```txt
pnpm-workspace.yaml
```

支持：

```yaml
packages:
  - packages/*
  - internal/*

catalog:
  typescript: ^6.0.3
```

第一版只支持 pnpm 默认 `catalog`。

不支持 pnpm named catalogs。

### 6.5 Workspace package 发现

使用：

```txt
@npmcli/map-workspaces
```

原因：

- 复用 npm workspace 解析规则。
- 支持数组形式 workspaces。
- 支持 `{ packages: [] }` 形式 workspaces。
- 支持 include/exclude patterns。

pnpm 的 `packages` 会先转换成 npm-style `workspaces.packages`，再交给 `@npmcli/map-workspaces`。

workspace root package 不依赖 `@npmcli/map-workspaces` 返回结果，需要工具手动加入 package map。

## 7. Catalog 支持

catalog 来源：

- workspace root `package.json#catalog`
- `pnpm-workspace.yaml#catalog`
- 当前包向上找到的 `package.json#catalog`

支持协议：

```txt
catalog:
catalog:<name>
```

规则：

```txt
catalog:       -> 使用当前 dependency name 查 catalog
catalog:<name> -> 使用显式 name 查 catalog
```

示例：

```json
{
  "devDependencies": {
    "typescript": "catalog:"
  }
}
```

root catalog：

```json
{
  "catalog": {
    "typescript": "^6.0.3"
  }
}
```

结果：

```json
{
  "devDependencies": {
    "typescript": "^6.0.3"
  }
}
```

如果找不到 catalog key，报错。

如果配置为：

```json
{
  "dependencies": {
    "catalog": "error"
  }
}
```

则遇到任何 `catalog:` 都报错。

## 8. Workspace 协议支持

支持：

```txt
workspace:*
workspace:^
workspace:~
workspace:<range>
```

规则：

```txt
workspace:*       -> <workspace package version>
workspace:^       -> ^<workspace package version>
workspace:~       -> ~<workspace package version>
workspace:<range> -> <range>
```

如果 dependency name 不存在于 workspace package map，报错。

单包项目中如果找不到 workspace context，遇到 `workspace:` 报错。

如果配置为：

```json
{
  "dependencies": {
    "workspace": "error"
  }
}
```

则遇到任何 `workspace:` 都报错。

## 9. package.json 重写

staging 中的 `package.json` 是发布态 metadata。

默认删除字段：

```txt
private
scripts
devDependencies
```

默认保留字段：

```txt
name
version
type
license
bin
exports
types
dependencies
peerDependencies
optionalDependencies
engines
files
publishConfig
preparePublishConfig
```

第一版可以保留 `preparePublishConfig`，也可以从 staging 中移除。

推荐第一版移除 `preparePublishConfig`，因为它只服务源码仓库，不服务消费者。

因此默认 `metadata.remove` 实际建议为：

```json
["private", "scripts", "devDependencies", "preparePublishConfig"]
```

但如果希望 staging 可追溯，可以暂时保留。第一版实现时需要做一次最终确认。

依赖字段处理范围：

```txt
dependencies
peerDependencies
optionalDependencies
devDependencies
```

虽然 `devDependencies` 最后会删除，但仍然先校验其中的 `catalog:` 和 `workspace:`，避免源码 metadata 腐化。

重写后，发布态 dependency fields 不能残留：

```txt
catalog:
workspace:
```

残留即报错。

## 10. 文件 staging

使用 npm 官方 pack 规则，而不是手写 include/exclude。

工具链：

```txt
@npmcli/arborist
npm-packlist
```

流程：

1. `new Arborist({ path: packageDir })`
2. `await arborist.loadActual()`
3. `await packlist(tree)`
4. 得到真实 pack 文件列表
5. 复制这些文件到 staging dir
6. 写入重写后的 `package.json`

这样可以复用：

- `files`
- `.npmignore`
- `.gitignore`
- npm 默认 ignore 规则
- README/LICENSE/package.json 默认包含规则

## 11. Staging 目录

默认输出：

```txt
.prepare-publish
```

包目录命名：

```txt
@slate/compiler          -> @slate__compiler
@slate/language-server   -> @slate__language-server
slate-vscode             -> slate-vscode
```

规则：

```txt
/ -> __
```

其它字符保持不变。

## 12. dry-run 输出

当前包示例：

```txt
Prepare publish plan

mode: current-package
root: /Users/bourdon/dev/my-package
package manager: npm
out: .prepare-publish

my-package 1.0.0
  source: .
  target: .prepare-publish/my-package
  files: 8
  rewrite: none
```

workspace 示例：

```txt
Prepare publish plan

mode: workspace
root: /Users/bourdon/dev/astro-like
workspace: package-json
package manager: bun
out: .prepare-publish

@slate/compiler 0.0.1-alpha.4
  source: packages/compiler
  target: .prepare-publish/@slate__compiler
  files: 18
  rewrite:
    dependencies.typescript: catalog: -> ^6.0.3

@slate/check 0.0.1-alpha.5
  source: packages/language-tools/check
  target: .prepare-publish/@slate__check
  files: 12
  rewrite:
    dependencies.@slate/compiler: workspace:^ -> ^0.0.1-alpha.4
```

## 13. 错误处理

错误信息必须包含：

- package name
- field path
- 原始值
- 原因

示例：

```txt
@slate/cli dependencies.@slate/check uses "workspace:^" but @slate/check was not found in the workspace.
```

```txt
@slate/vite devDependencies.typescript uses "catalog:" but catalog has no "typescript" entry.
```

```txt
my-package dependencies.foo uses "workspace:*" but workspace protocol is only supported in workspace context.
```

推荐收集全部 validation errors 后统一输出。

## 14. publint

第一版不强制运行 `publint`。

后续可以支持：

```sh
bun run prepare-publish --lint @slate/compiler
```

原因：

- 当前孵化阶段主要面向 JSR source package。
- `publint` 更偏 npm package metadata 校验。
- 第一版应该先把 staging 和协议 rewrite 做稳。

## 15. 与 internal/bump 的关系

`internal/bump` 负责：

- 选择包。
- 更新 version。
- 写 changelog。
- 更新 workspace dependency range。

`internal/prepare-publish` 负责：

- 读取已经 bump 后的 metadata。
- 生成 staging。
- 校验不能发布的协议和字段。

两者不应该互相调用。

当前仓库推荐流程：

```sh
bun run bump
bun run build
bun run prepare-publish --all
cd .prepare-publish/@slate__compiler
npx jsr publish --dry-run
```

## 16. 模块设计

建议模块：

```txt
src/index.ts
src/cli.ts
src/config.ts
src/current-package.ts
src/workspace.ts
src/package-plan.ts
src/rewrite-package-json.ts
src/stage.ts
src/validate.ts
```

### `cli.ts`

负责 argv 解析、日志输出和 exit code。

### `config.ts`

负责默认配置、root 配置、package 配置和 CLI flags 合并。

### `current-package.ts`

负责查找当前目录所属 package。

### `workspace.ts`

负责 workspace root 发现、workspace 配置读取、package map 构建和 root package 纳入。

### `package-plan.ts`

负责 target 选择、文件列表计算、staging path 计算。

### `rewrite-package-json.ts`

负责 metadata 清理、`catalog:` 重写、`workspace:` 重写和 rewrite summary。

### `stage.ts`

负责创建 staging dir、复制文件和写入重写后的 package.json。

### `validate.ts`

负责 validation errors 的收集和格式化。

## 17. 类型草案

```ts
type PreparePublishConfig = {
  publish: boolean;
  target: "jsr" | "npm";
  out: string;
  workspace: {
    packages: string[];
    exclude: string[];
    root: "auto" | "include" | "exclude";
  };
  package: {
    private: "error" | "allow";
  };
  dependencies: {
    workspace: "rewrite" | "error";
    catalog: "rewrite" | "error";
  };
  metadata: {
    remove: string[];
  };
  commands: {
    before: string[];
  };
};
```

```ts
type PreparePublishOptions = {
  targets: string[];
  all: boolean;
  dryRun: boolean;
  clean: boolean;
  out?: string;
  target?: "jsr" | "npm";
};
```

```ts
type WorkspacePackage = {
  name: string;
  version: string;
  dir: string;
  relativeDir: string;
  packageJsonPath: string;
  packageJson: JsonObject;
  private: boolean;
  root: boolean;
};
```

```ts
type RewriteSummary = {
  field: string;
  name: string;
  from: string;
  to: string;
};
```

```ts
type PreparePlan = {
  pkg: WorkspacePackage;
  config: PreparePublishConfig;
  stagingDir: string;
  files: string[];
  rewrittenPackageJson: JsonObject;
  rewrites: RewriteSummary[];
  errors: PreparePublishError[];
};
```

```ts
type PreparePublishError = {
  packageName: string;
  path: string;
  value?: unknown;
  message: string;
};
```

## 18. 第一版完成标准

第一版完成后应该支持：

```sh
bun run prepare-publish --dry-run
bun run prepare-publish
bun run prepare-publish --dry-run @slate/compiler
bun run prepare-publish @slate/compiler
bun run prepare-publish --all
```

必须满足：

- 当前包可独立 staging。
- workspace 指定包可 staging。
- workspace `--all` 可 staging 多包。
- root package 可作为发布包参与。
- `publish: false` 会让包退出发布集合。
- `private: true` 默认报错或跳过。
- `catalog:` 可被重写或按配置报错。
- `workspace:` 可被重写或按配置报错。
- staging package.json 不残留 `catalog:` 或 `workspace:`。
- staging 过程不修改源码目录。

## 19. 后续扩展

### 自动发布

未来可以支持：

```sh
bun run prepare-publish --publish jsr @slate/compiler
```

第一版不做。

### npm dist 发布

未来可以参考 `hornjs/prepare-publish` 支持：

```json
{
  "publishConfig": {
    "directories": {
      "src": "dist"
    }
  }
}
```

然后做：

```txt
exports ./src/index.ts -> ./dist/index.mjs
```

第一版不做。

### changed packages

未来可以支持：

```sh
bun run prepare-publish --changed
```

基于 git diff 判断需要发布的包。

第一版不做。
