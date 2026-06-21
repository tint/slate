declare module "*.slate" {
  type SlateHTML = {
    readonly value: string;
  };

  type RenderResult = SlateHTML | Promise<SlateHTML>;

  const component: {
    render(props?: Record<string, unknown>, slots?: Record<string, unknown>, context?: unknown): RenderResult;
  };
  export default component;
}
