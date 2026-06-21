import { unified } from "unified";
import rehypeFormat from "rehype-format";
import rehypeMinifyWhitespace from "rehype-minify-whitespace";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import type { SlateHtmlOptions } from "./types";

/**
 * Apply user-configured HTML postprocessing to the final rendered document.
 *
 * This intentionally runs after Slate render, global asset injection, CSS import
 * injection, and Vite HTML transforms. Terser/minifiers only understand bundled
 * JavaScript; this step operates on the actual HTML string that will be served
 * or written to disk.
 */
export async function processHtml(html: string, options: SlateHtmlOptions | undefined): Promise<string> {
  const format = options?.format ?? "preserve";
  const rehypePlugins = options?.rehypePlugins ?? [];

  // Fast path for the default. Avoid parsing user HTML unless a transform is
  // explicitly requested, preserving exact output and avoiding dev overhead.
  if (format === "preserve" && rehypePlugins.length === 0) {
    return html;
  }

  // Slate can render full documents or fragments. `fragment: true` supports
  // both without forcing rehype to synthesize html/head/body wrappers.
  const processor = unified().use(rehypeParse, {
    fragment: true,
  });

  // User transforms run before Slate's formatting choice so users can modify
  // the tree first, then let Slate serialize in the requested output shape.
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
