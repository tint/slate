import { cloneContext, html as __slateHtml, evaluateSlateExpression, renderValue } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const user = { name: "Slate" };
  let __html = "";
  __html += "\n\n";
  __html += [
    "<div",
    ">",
    "\n  ",
    (() => { console.log("[slate:debug]", evaluateSlateExpression(() => (user), {"filename":"component.slate","range":{"start":73,"end":78},"kind":"template"})); return ""; })(),
    "\n  ",
    [
    "<p",
    ">",
    await renderValue(evaluateSlateExpression(() => (user.name), {"filename":"component.slate","range":{"start":86,"end":95},"kind":"template"})),
    "</p>"
  ].join(""),
    "\n",
    "</div>"
  ].join("");
  __html += "\n";
  return __slateHtml(__html);
}
export default { render };