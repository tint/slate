import { cloneContext, html as __slateHtml, evaluateSlateExpression, renderHTML } from "@slate/kit";
import Card from "./Card.slate";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const props = {
      title: "Hello",
  };
  let __html = "";
  __html += "\n\n";
  __html += await renderHTML(await Card.render({ "title": evaluateSlateExpression(() => (props.title), {"filename":"component.slate","range":{"start":185,"end":196},"kind":"component"}) }, {}, context));
  return __slateHtml(__html);
}
export default { render };
