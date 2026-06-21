import { cloneContext, html as __slateHtml, evaluateSlateExpression, renderHTML, renderValue } from "@slate/kit";
import Card from "./Card.slate";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  let __html = "";
  __html += "\n\n";
  __html += await renderHTML(await Card.render({  }, {
      "default": async () => {
        let __html = "";
        __html += "\n  ";
        __html += "\n";
        return __slateHtml(__html);
      },
      "header": async ({ title, icon, tail }) => {
        let __html = "";
        __html += [
          "<header",
          ">",
          "\n    ",
          await renderValue(evaluateSlateExpression(() => (icon), {"filename":"component.slate","range":{"start":120,"end":124},"kind":"template"})),
          "\n    ",
          [
          "<h1",
          ">",
          await renderValue(evaluateSlateExpression(() => (title), {"filename":"component.slate","range":{"start":135,"end":140},"kind":"template"})),
          "</h1>"
        ].join(""),
          "\n    ",
          await renderValue(evaluateSlateExpression(() => (tail), {"filename":"component.slate","range":{"start":152,"end":156},"kind":"template"})),
          "\n  ",
          "</header>"
        ].join("");
        return __slateHtml(__html);
      }
    }, context));
  __html += "\n";
  return __slateHtml(__html);
}
export default { render };