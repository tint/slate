import { cloneContext, html as __slateHtml, evaluateSlateExpression, renderValue, jsx as __slateJsx } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
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