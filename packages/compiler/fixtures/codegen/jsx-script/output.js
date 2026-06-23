import { cloneContext, html as __slateHtml, evaluateSlateExpression, renderValue, jsx as __slateElement, Fragment as __slateFragment } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const __slateJsx = (type, props, ...children) => {
    if (typeof type === "string" || type === __slateFragment) {
      return __slateElement(type, props, ...children);
    }
    if (type && typeof type.render === "function") {
      const normalizedChildren = children.length > 0 ? children : props?.children === undefined ? [] : [props.children];
      const componentProps = props?.children === undefined ? props ?? {} : Object.fromEntries(Object.entries(props).filter(([name]) => name !== "children"));
      const componentSlots = normalizedChildren.length > 0 ? { default: async () => __slateHtml(await renderValue(normalizedChildren)) } : {};
      return type.render(componentProps, componentSlots, context);
    }
    throw new Error("Unsupported Slate JSX component.");
  };
  const icon = __slateJsx("strong", { class: ["mark", { active: true }] }, "Ready");
  let __html = "";
  __html += "\n\n";
  __html += [
    "<p",
    ">",
    await renderValue(evaluateSlateExpression(() => (icon), {"filename":"component.slate","range":{"start":102,"end":106},"kind":"template"})),
    "</p>"
  ].join("");
  __html += "\n";
  return __slateHtml(__html);
}
export default { render };