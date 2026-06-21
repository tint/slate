import { cloneContext, html as __slateHtml, evaluateSlateExpression, renderHTML } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const content = "<strong>Raw</strong>";
  let __html = "";
  __html += "\n\n";
  __html += [
    "<div",
    ">",
    await renderHTML(evaluateSlateExpression(() => (content), {"filename":"component.slate","range":{"start":87,"end":95},"kind":"template"})),
    "</div>"
  ].join("");
  __html += "\n";
  return __slateHtml(__html);
}
export default { render };