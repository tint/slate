import { cloneContext, escapeHTML, evaluateSlateExpression } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const user = { name: "Slate" };
  let __html = "";
  __html += "\n\n";
  if (evaluateSlateExpression(() => (user), {"filename":"component.slate","range":{"start":89,"end":94},"kind":"template"})) {
    __html += "\n  ";
    __html += [
      "<p",
      ">",
      "Hello ",
      escapeHTML(evaluateSlateExpression(() => (user.name), {"filename":"component.slate","range":{"start":108,"end":117},"kind":"template"})),
      "</p>"
    ].join("");
    __html += "\n";
  } else {
    __html += "\n  ";
    __html += [
      "<p",
      ">",
      "Hello guest",
      "</p>"
    ].join("");
    __html += "\n";
  }
  __html += "\n";
  return __html;
}
export default { render };