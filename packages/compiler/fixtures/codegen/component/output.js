import { cloneContext, html as __slateHtml, evaluateSlateExpression, renderHTML, renderValue } from "@slate/kit";
import Card from "./Card.slate";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const title = "Hello";
  let __html = "";
  __html += "\n\n";
  __html += await renderHTML(await Card.render({ "title": evaluateSlateExpression(() => (title), {"filename":"component.slate","range":{"start":108,"end":113},"kind":"component"}), "featured": true }, {
      "default": async () => {
        let __html = "";
        __html += "\n  ";
        __html += "\n  ";
        __html += [
          "<p",
          ">",
          "Hello ",
          await renderValue(evaluateSlateExpression(() => (title), {"filename":"component.slate","range":{"start":167,"end":172},"kind":"template"})),
          "</p>"
        ].join("");
        __html += "\n";
        return __slateHtml(__html);
      },
      "title": async () => {
        let __html = "";
        __html += [
          "<h1",
          ">",
          await renderValue(evaluateSlateExpression(() => (title), {"filename":"component.slate","range":{"start":143,"end":148},"kind":"template"})),
          "</h1>"
        ].join("");
        return __slateHtml(__html);
      }
    }, context));
  __html += "\n";
  return __slateHtml(__html);
}
export default { render };