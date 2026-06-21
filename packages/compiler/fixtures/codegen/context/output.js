import { cloneContext, html as __slateHtml, evaluateSlateExpression, renderHTML, renderSlot, serializeAttribute, serializeStyle } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const $provide = (name, value) => { context.provides[name] = value; };
  const $inject = (name, fallback) => Object.hasOwn(context.provides, name) ? context.provides[name] : fallback;
  $provide("theme", {
      color: "red",
      spacing: 8,
  });
  const theme = $inject("theme");
  let __html = "";
  __html += "\n\n";
  __html += [
    "<div",
    serializeAttribute("style", serializeStyle(evaluateSlateExpression(() => ({ color: theme.color }), {"filename":"component.slate","range":{"start":182,"end":204},"kind":"template"}))),
    ">",
    "\n  ",
    await renderHTML(await renderSlot(slots, "default", __slateHtml(""), undefined)),
    "\n",
    "</div>"
  ].join("");
  __html += "\n";
  return __slateHtml(__html);
}
export default { render };