import { cloneContext, cloneData, escapeHTML, evaluateSlateExpression, renderSlot, serializeStyle } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const $provide = (name, value) => { context.provides[name] = cloneData(value); };
  const $inject = (name, fallback) => Object.hasOwn(context.provides, name) ? cloneData(context.provides[name]) : cloneData(fallback);
  $provide("theme", {
      color: "red",
      spacing: 8,
  });
  const theme = $inject("theme");
  let __html = "";
  __html += "\n\n";
  __html += [
    "<div",
    " style=\"",
    escapeHTML(serializeStyle(evaluateSlateExpression(() => ({ color: theme.color }), {"filename":"component.slate","range":{"start":182,"end":204},"kind":"template"}))),
    "\"",
    ">",
    "\n  ",
    await renderSlot(slots, "default", "", undefined),
    "\n",
    "</div>"
  ].join("");
  __html += "\n";
  return __html;
}
export default { render };