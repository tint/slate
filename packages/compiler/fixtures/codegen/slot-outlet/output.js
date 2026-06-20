import { cloneContext, escapeHTML, evaluateSlateExpression, renderSlot } from "@slate/kit";
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
    await renderSlot(slots, "title", [
        escapeHTML(evaluateSlateExpression(() => (title), {"filename":"component.slate","range":{"start":113,"end":118},"kind":"template"}))
      ].join(""), undefined),
    "\n  ",
    "</header>"
  ].join(""),
    "\n\n  ",
    [
    "<main",
    ">",
    "\n    ",
    await renderSlot(slots, "default", "", undefined),
    "\n  ",
    "</main>"
  ].join(""),
    "\n",
    "</section>"
  ].join("");
  __html += "\n";
  return __html;
}
export default { render };