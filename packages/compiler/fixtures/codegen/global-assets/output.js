import { cloneContext, html as __slateHtml, addGlobalAsset } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  let __html = "";
  __html += addGlobalAsset(context, "head", [
    "<style",
    ">",
    "\n  .global {}\n",
    "</style>"
  ].join(""));
  __html += "\n\n";
  __html += addGlobalAsset(context, "head", [
    "<script",
    ">",
    "\n  globalThis.head = true;\n",
    "</script>"
  ].join(""));
  __html += "\n\n";
  __html += addGlobalAsset(context, "tail", [
    "<script",
    ">",
    "\n  globalThis.tail = true;\n",
    "</script>"
  ].join(""));
  __html += "\n\n";
  __html += [
    "<style",
    ">",
    "\n  .inline {}\n",
    "</style>"
  ].join("");
  __html += "\n";
  return __slateHtml(__html);
}
export default { render };