import { cloneContext, html as __slateHtml, evaluateSlateExpression, renderValue, jsx as __slateElement, Fragment as __slateFragment } from "@slate/kit";
import Card from "./Card.slate";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const __slateJsx = (type, props, ...children) => {
    if (typeof type === "string" || type === __slateFragment) {
      return __slateElement(type, props, ...children);
    }
    if (type && typeof type.render === "function") {
      if (children.length > 0 || props?.children !== undefined) {
        throw new Error("Slate component JSX children are not supported yet.");
      }
      return type.render(props ?? {}, {}, context);
    }
    throw new Error("Unsupported Slate JSX component.");
  };
  const scriptCard = __slateJsx(Card, { title: "From script" });
  let __html = "";
  __html += "\n\n";
  __html += [
    "<main",
    ">",
    await renderValue(evaluateSlateExpression(() => (scriptCard), {"filename":"component.slate","range":{"start":116,"end":126},"kind":"template"})),
    "</main>"
  ].join("");
  __html += "\n";
  __html += [
    "<section",
    ">",
    await renderValue(evaluateSlateExpression(() => (__slateJsx(Card, { title: "From template" })), {"filename":"component.slate","range":{"start":145,"end":175},"kind":"template"})),
    "</section>"
  ].join("");
  __html += "\n";
  return __slateHtml(__html);
}
export default { render };