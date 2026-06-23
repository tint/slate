import { cloneContext, html as __slateHtml, evaluateSlateExpression, renderValue, jsx as __slateElement, Fragment as __slateFragment } from "@slate/kit";
import Card from "./Card.slate";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const __slateComponents = new Set([Card]);
  const __slateJsx = (type, props, ...children) => {
    if (typeof type === "string" || type === __slateFragment) {
      return __slateElement(type, props, ...children);
    }
    if (__slateComponents.has(type)) {
      const normalizedChildren = children.length > 0 ? children : props?.children === undefined ? [] : [props.children];
      const providedSlots = props?.slots ?? {};
      if (normalizedChildren.length > 0 && providedSlots.default) {
        throw new Error("Slate component JSX cannot combine children with slots.default.");
      }
      const componentProps = props ? Object.fromEntries(Object.entries(props).filter(([name]) => name !== "children" && name !== "slots")) : {};
      const componentSlots = {
        ...providedSlots,
        ...(normalizedChildren.length > 0 ? { default: async () => __slateHtml(await renderValue(normalizedChildren)) } : {}),
      };
      return type.render(componentProps, componentSlots, context);
    }
    throw new Error("Unsupported Slate JSX component.");
  };
  const scriptCard = (__slateJsx(Card, { title: "From script", slots: {
          header: () => __slateJsx("h1", null, "Script header"),
      } },
      __slateJsx("p", null, "Script child")));
  let __html = "";
  __html += "\n\n";
  __html += [
    "<main",
    ">",
    await renderValue(evaluateSlateExpression(() => (scriptCard), {"filename":"component.slate","range":{"start":225,"end":235},"kind":"template"})),
    "</main>"
  ].join("");
  __html += "\n";
  __html += [
    "<section",
    ">",
    await renderValue(evaluateSlateExpression(() => (__slateJsx(Card, { title: "From template", slots: { default: () => __slateJsx("p", null, "Template default"), header: () => __slateJsx("h1", null, "Template header") } })), {"filename":"component.slate","range":{"start":254,"end":375},"kind":"template"})),
    "</section>"
  ].join("");
  __html += "\n";
  return __slateHtml(__html);
}
export default { render };