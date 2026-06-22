import { cloneContext, html as __slateHtml, evaluateSlateExpression, renderValue, serializeAttribute } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const title = "Hello";
  const items = ["a", "b"];
  let __html = "";
  __html += "\n\n";
  __html += [
    "<h1",
    ">",
    await renderValue(evaluateSlateExpression(() => (title), {"filename":"input.slate","range":{"start":80,"end":85},"kind":"template"})),
    "</h1>"
  ].join("");
  __html += "\n\n";
  if (evaluateSlateExpression(() => (items.length), {"filename":"input.slate","range":{"start":97,"end":110},"kind":"template"})) {
    __html += "\n  ";
    __html += [
      "<ul",
      ">",
      "\n    ",
      (await Promise.all(Array.from(evaluateSlateExpression(() => (items), {"filename":"input.slate","range":{"start":129,"end":134},"kind":"template"})).map(async (item) => {
              return [
                "\n      ",
              [
      "<li",
      serializeAttribute("data-item", evaluateSlateExpression(() => (item), {"filename":"input.slate","range":{"start":166,"end":170},"kind":"template"})),
      ">",
      await renderValue(evaluateSlateExpression(() => (item), {"filename":"input.slate","range":{"start":173,"end":177},"kind":"template"})),
      "</li>"
    ].join(""),
              "\n    "
              ].join("");
            }))).join(""),
      "\n  ",
      "</ul>"
    ].join("");
    __html += "\n";
  }
  __html += "\n";
  return __slateHtml(__html);
}
export default { render };