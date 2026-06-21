import { cloneContext, html as __slateHtml, evaluateSlateExpression, renderHTML, renderSlot, renderValue } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const title = "Fallback title";
  let __html = "";
  __html += "\n\n";
  __html += [
    "<section",
    ">",
    "\n  ",
    [
    "<header",
    ">",
    "\n    ",
    await renderHTML(await renderSlot(slots, "title", __slateHtml([
        await renderValue(evaluateSlateExpression(() => (title), {"filename":"component.slate","range":{"start":113,"end":118},"kind":"template"}))
      ].join("")), undefined)),
    "\n  ",
    "</header>"
  ].join(""),
    "\n\n  ",
    [
    "<main",
    ">",
    "\n    ",
    await renderHTML(await renderSlot(slots, "default", __slateHtml(""), undefined)),
    "\n  ",
    "</main>"
  ].join(""),
    "\n",
    "</section>"
  ].join("");
  __html += "\n";
  return __slateHtml(__html);
}
export default { render };