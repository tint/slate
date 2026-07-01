declare module "@npmcli/arborist" {
  export default class Arborist {
    constructor(options: { path: string });
    loadActual(): Promise<unknown>;
  }
}

declare module "@npmcli/map-workspaces" {
  export default function mapWorkspaces(options: { cwd: string; pkg: object }): Promise<Map<string, string>>;
}

declare module "npm-packlist" {
  export default function packlist(tree: unknown): Promise<string[]>;
}
