import { cloneContext, html as __slateHtml, evaluateSlateExpression, renderValue } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const name = "Slate";
  let __html = "";
  __html += "\n\n";
  __html += [
    "<h1",
    ">",
    "Hello ",
    await renderValue(evaluateSlateExpression(() => (name), {"filename":"component.slate","range":{"start":69,"end":73},"kind":"template"})),
    "</h1>"
  ].join("");
  __html += "\n";
  return __slateHtml(__html);
}
export default { render };