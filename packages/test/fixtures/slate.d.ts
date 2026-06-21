declare module "*.slate" {
  import type { RenderResult } from "@slate/kit";

  const component: {
    render(props?: Record<string, unknown>, slots?: Record<string, unknown>, context?: unknown): RenderResult;
  };
  export default component;
}
