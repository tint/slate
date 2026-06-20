import { cloneContext } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  let __html = "";
  __html += [
    "<script",
    ">",
    "\n  console.log(\"{not slate}\");\n",
    "</script>"
  ].join("");
  __html += "\n\n";
  __html += [
    "<style",
    ">",
    "\n  .card::before {\n    content: \"{\";\n  }\n",
    "</style>"
  ].join("");
  __html += "\n";
  return __html;
}
export default { render };