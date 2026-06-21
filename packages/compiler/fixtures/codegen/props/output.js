import { cloneContext, html as __slateHtml, evaluateSlateExpression, renderValue } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  const $prop = (name, defaultValue) => Object.hasOwn(__props, name) ? __props[name] : defaultValue;
  const $props = (defaults = {}) => ({ ...defaults, ...__props });
  const title = $prop("title", "Untitled");
  const props = $props({
      count: 0,
  });
  let __html = "";
  __html += "\n\n";
  __html += [
    "<h1",
    ">",
    await renderValue(evaluateSlateExpression(() => (title), {"filename":"component.slate","range":{"start":155,"end":160},"kind":"template"})),
    "</h1>"
  ].join("");
  __html += "\n";
  __html += [
    "<p",
    ">",
    await renderValue(evaluateSlateExpression(() => (props.count), {"filename":"component.slate","range":{"start":171,"end":182},"kind":"template"})),
    "</p>"
  ].join("");
  __html += "\n";
  return __slateHtml(__html);
}
export default { render };