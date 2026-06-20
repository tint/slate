import { cloneContext, escapeHTML, evaluateSlateExpression, serializeClass, serializeStyle } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const active = true;
  const visible = false;
  let __html = "";
  __html += "\n\n";
  __html += [
    "<div",
    " class=\"",
    escapeHTML(serializeClass(evaluateSlateExpression(() => (["card", active && "active", { hidden: !visible }]), {"filename":"component.slate","range":{"start":106,"end":156},"kind":"template"}))),
    "\"",
    " style=\"",
    escapeHTML(serializeStyle(evaluateSlateExpression(() => ([
      "color: red",
      { marginTop: "8px", display: visible ? "block" : "none" },
    ]), {"filename":"component.slate","range":{"start":167,"end":253},"kind":"template"}))),
    "\"",
    ">",
    "\n  Content\n",
    "</div>"
  ].join("");
  __html += "\n";
  return __html;
}
export default { render };