import {
  cloneContext,
  injectCollectedAssets,
  type SlateContext,
  type Slots,
} from "@slate/kit";

export type SlateRenderable<TProps = Record<string, unknown>, TSlots extends Slots = Slots> = {
  render(props?: TProps, slots?: TSlots, context?: SlateContext): string | Promise<string>;
};

export type RenderSlateOptions<TProps = Record<string, unknown>, TSlots extends Slots = Slots> = {
  props?: TProps;
  slots?: TSlots;
  context?: SlateContext;
};

/**
 * Render a compiled Slate component for tests and return final HTML.
 *
 * This mirrors the runtime path used by build/dev: it creates a child render
 * context, executes the component render function, then injects collected
 * `is:global` assets. Slot data and context values keep Slate's normal
 * reference semantics.
 */
export async function renderSlate<TProps = Record<string, unknown>, TSlots extends Slots = Slots>(
  component: SlateRenderable<TProps, TSlots>,
  options: RenderSlateOptions<TProps, TSlots> = {},
): Promise<string> {
  const context = cloneContext(options.context);
  const props = options.props ?? ({} as TProps);
  const slots = options.slots ?? ({} as TSlots);
  const html = await component.render(props, slots, context);
  return injectCollectedAssets(html, context);
}
