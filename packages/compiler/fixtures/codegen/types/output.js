import { cloneContext, escapeHTML, evaluateSlateExpression } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const title = "Hello";
  let __html = "";
  __html += "\n\n";
  __html += [
    "<h1",
    ">",
    escapeHTML(evaluateSlateExpression(() => (title), {"filename":"component.slate","range":{"start":169,"end":174},"kind":"template"})),
    "</h1>"
  ].join("");
  __html += "\n";
  return __html;
}
export default { render };