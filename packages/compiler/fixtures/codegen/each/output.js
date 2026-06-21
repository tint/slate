import { cloneContext, html as __slateHtml, evaluateSlateExpression, renderValue } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const items = ["a", "b"];
  let __html = "";
  __html += "\n\n";
  __html += [
    "<ul",
    ">",
    "\n  ",
    await (async () => {
          const __items = Array.from(evaluateSlateExpression(() => (items), {"filename":"component.slate","range":{"start":77,"end":82},"kind":"template"}));
          return __items.length ? (await Promise.all(__items.map(async (item, index) => [
            "\n    ",
            [
    "<li",
    ">",
    await renderValue(evaluateSlateExpression(() => (index), {"filename":"component.slate","range":{"start":109,"end":114},"kind":"template"})),
    ": ",
    await renderValue(evaluateSlateExpression(() => (item), {"filename":"component.slate","range":{"start":118,"end":122},"kind":"template"})),
    "</li>"
  ].join(""),
            "\n  "
          ].join("")))).join("") : [
          "\n    ",
          [
    "<li",
    ">",
    "No items",
    "</li>"
  ].join(""),
          "\n  "
        ].join("");
        })(),
    "\n",
    "</ul>"
  ].join("");
  __html += "\n";
  return __slateHtml(__html);
}
export default { render };