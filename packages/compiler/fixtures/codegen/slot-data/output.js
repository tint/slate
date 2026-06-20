import { cloneContext, escapeHTML, evaluateSlateExpression } from "@slate/kit";
import Card from "./Card.slate";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  let __html = "";
  __html += "\n\n";
  __html += await Card.render({  }, {
      "default": async () => {
        let __html = "";
        __html += "\n  ";
        __html += "\n";
        return __html;
      },
      "header": async ({ title, icon, tail }) => {
        let __html = "";
        __html += [
          "<header",
          ">",
          "\n    ",
          escapeHTML(evaluateSlateExpression(() => (icon), {"filename":"component.slate","range":{"start":120,"end":124},"kind":"template"})),
          "\n    ",
          [
          "<h1",
          ">",
          escapeHTML(evaluateSlateExpression(() => (title), {"filename":"component.slate","range":{"start":135,"end":140},"kind":"template"})),
          "</h1>"
        ].join(""),
          "\n    ",
          escapeHTML(evaluateSlateExpression(() => (tail), {"filename":"component.slate","range":{"start":152,"end":156},"kind":"template"})),
          "\n  ",
          "</header>"
        ].join("");
        return __html;
      }
    }, context);
  __html += "\n";
  return __html;
}
export default { render };