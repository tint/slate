import { unified } from "unified";
import rehypeFormat from "rehype-format";
import rehypeMinifyWhitespace from "rehype-minify-whitespace";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import type { SlateHtmlOptions } from "./types";

/** Apply user-configured HTML postprocessing to rendered Slate output. */
export async function processHtml(html: string, options: SlateHtmlOptions | undefined): Promise<string> {
  const format = options?.format ?? "preserve";
  const rehypePlugins = options?.rehypePlugins ?? [];

  if (format === "preserve" && rehypePlugins.length === 0) {
    return html;
  }

  const processor = unified().use(rehypeParse, {
    fragment: true,
  });

  if (rehypePlugins.length > 0) {
    processor.use(rehypePlugins);
  }

  if (format === "pretty") {
    processor.use(rehypeFormat);
  }

  if (format === "minify") {
    processor.use(rehypeMinifyWhitespace);
  }

  processor.use(rehypeStringify);

  return String(await processor.process(html));
}
