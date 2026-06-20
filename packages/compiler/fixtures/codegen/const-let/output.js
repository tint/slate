import { cloneContext, escapeHTML, evaluateSlateExpression } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const name = "Slate";
  let __html = "";
  __html += "\n\n";
  const title = name.toUpperCase();
  __html += "\n";
  let count = 1;
  __html += "\n\n";
  __html += [
    "<h1",
    ">",
    escapeHTML(evaluateSlateExpression(() => (title), {"filename":"component.slate","range":{"start":115,"end":120},"kind":"template"})),
    "</h1>"
  ].join("");
  __html += "\n";
  __html += [
    "<p",
    ">",
    escapeHTML(evaluateSlateExpression(() => (count), {"filename":"component.slate","range":{"start":131,"end":136},"kind":"template"})),
    "</p>"
  ].join("");
  __html += "\n";
  return __html;
}
export default { render };