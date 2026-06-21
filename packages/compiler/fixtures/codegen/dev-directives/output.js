import { cloneContext } from "@slate/kit";
export async function render(__props = {}, slots = {}, context = {}) {
  context = cloneContext(context);
  let __html = "";
  __html += [
    "<main",
    ">",
    "\n  ",
    [
    "<section",
    ">",
    "Panel",
    "</section>"
  ].join(""),
    "\n",
    "</main>"
  ].join("");
  __html += "\n";
  return __html;
}
export default { render };