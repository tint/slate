import { cloneContext, escapeHTML, evaluateSlateExpression } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const items = ["a", "b"];
  let __html = "";
  __html += "\n\n";
  __html += [
    "<ul",
    ">",
    "\n  ",
    Array.from(evaluateSlateExpression(() => (items), {"filename":"component.slate","range":{"start":77,"end":82},"kind":"template"})).length ? Array.from(evaluateSlateExpression(() => (items), {"filename":"component.slate","range":{"start":77,"end":82},"kind":"template"})).map((item, index) => [
            "\n    ",
            [
    "<li",
    ">",
    escapeHTML(evaluateSlateExpression(() => (index), {"filename":"component.slate","range":{"start":109,"end":114},"kind":"template"})),
    ": ",
    escapeHTML(evaluateSlateExpression(() => (item), {"filename":"component.slate","range":{"start":118,"end":122},"kind":"template"})),
    "</li>"
  ].join(""),
            "\n  "
          ].join("")).join("") : [
          "\n    ",
          [
    "<li",
    ">",
    "No items",
    "</li>"
  ].join(""),
          "\n  "
        ].join(""),
    "\n",
    "</ul>"
  ].join("");
  __html += "\n";
  return __html;
}
export default { render };