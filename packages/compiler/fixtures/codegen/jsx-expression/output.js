import { cloneContext, html as __slateHtml, evaluateSlateExpression, renderValue, jsx as __slateJsx, Fragment as __slateFragment } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const visible = true;
  const items = ["<A>", "B"];
  let __html = "";
  __html += "\n\n";
  __html += [
    "<div",
    ">",
    await renderValue(evaluateSlateExpression(() => (__slateJsx("strong", { class: "mark" }, "<Slate>")), {"filename":"component.slate","range":{"start":82,"end":123},"kind":"template"})),
    "</div>"
  ].join("");
  __html += "\n";
  __html += [
    "<p",
    ">",
    await renderValue(evaluateSlateExpression(() => (visible ? __slateJsx("span", null, "Yes") : __slateJsx("span", null, "No")), {"filename":"component.slate","range":{"start":135,"end":179},"kind":"template"})),
    "</p>"
  ].join("");
  __html += "\n";
  __html += [
    "<ul",
    ">",
    await renderValue(evaluateSlateExpression(() => (items.map(item => __slateJsx("li", null, item))), {"filename":"component.slate","range":{"start":190,"end":224},"kind":"template"})),
    "</ul>"
  ].join("");
  __html += "\n";
  __html += [
    "<section",
    ">",
    await renderValue(evaluateSlateExpression(() => (__slateJsx(__slateFragment, null,
      "A",
      __slateJsx("span", null, "B"))), {"filename":"component.slate","range":{"start":241,"end":265},"kind":"template"})),
    "</section>"
  ].join("");
  __html += "\n";
  return __slateHtml(__html);
}
export default { render };