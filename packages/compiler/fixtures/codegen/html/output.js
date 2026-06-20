import { cloneContext, evaluateSlateExpression } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const content = "<strong>Raw</strong>";
  let __html = "";
  __html += "\n\n";
  __html += [
    "<div",
    ">",
    String(evaluateSlateExpression(() => (content), {"filename":"component.slate","range":{"start":87,"end":95},"kind":"template"})),
    "</div>"
  ].join("");
  __html += "\n";
  return __html;
}
export default { render };