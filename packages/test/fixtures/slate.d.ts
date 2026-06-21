declare module "*.slate" {
  const component: {
    render(props?: Record<string, unknown>, slots?: Record<string, unknown>, context?: unknown): Promise<string>;
  };
  export default component;
}
