export type JsonObject = Record<string, unknown>;

export type PackageManager = "bun" | "pnpm" | "yarn" | "npm" | "unknown";

export type PublishTarget = "jsr" | "npm";

export type PreparePublishConfig = {
  publish: boolean;
  target: PublishTarget;
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

export type PreparePublishOptions = {
  targets: string[];
  all: boolean;
  dryRun: boolean;
  clean: boolean;
  out?: string;
  target?: PublishTarget;
};

export type WorkspacePackage = {
  name: string;
  version: string;
  dir: string;
  relativeDir: string;
  packageJsonPath: string;
  packageJson: JsonObject;
  private: boolean;
  root: boolean;
};

export type WorkspaceContext = {
  root: string;
  source: "package-json" | "pnpm-workspace-yaml";
  packageManager: PackageManager;
  rootPackage: WorkspacePackage | undefined;
  packages: Map<string, WorkspacePackage>;
  catalog: Record<string, string>;
};

export type CurrentPackageContext = {
  packageManager: PackageManager;
  pkg: WorkspacePackage;
  catalog: Record<string, string>;
  workspace: WorkspaceContext | undefined;
};

export type RewriteSummary = {
  field: string;
  name: string;
  from: string;
  to: string;
};

export type PreparePublishError = {
  packageName: string;
  path: string;
  value?: unknown;
  message: string;
};

export type PreparePlan = {
  pkg: WorkspacePackage;
  config: PreparePublishConfig;
  stagingDir: string;
  files: string[];
  rewrittenPackageJson: JsonObject;
  rewrites: RewriteSummary[];
  errors: PreparePublishError[];
};
