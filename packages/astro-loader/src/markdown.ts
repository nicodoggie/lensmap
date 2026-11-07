import { fileURLToPath } from "node:url";
import rehypeParse from "rehype-parse";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";

/** Restore Astro's inert image markers before sanitizing, importing local files as URLs only. */
export async function sanitizeMarkdown(
  code: string,
  fileUrl: URL,
  identity: string,
) {
  const processor = unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeSanitize)
    .use(rehypeStringify);
  const tree = processor.parse(code);
  const assets: { path: string; token: string }[] = [];
  function visit(node: unknown) {
    if (!node || typeof node !== "object") return;
    const element = node as {
      tagName?: string;
      properties?: Record<string, unknown>;
      children?: unknown[];
    };
    if (element.tagName === "img" && element.properties) {
      const properties = element.properties;
      const marker = Object.entries(properties).find(
        ([key]) => key.toLowerCase() === "__astro_image_",
      );
      if (marker && typeof marker[1] === "string") {
        const restored: unknown = JSON.parse(marker[1]);
        if (restored && typeof restored === "object")
          Object.assign(properties, restored);
        delete properties[marker[0]];
      }
      const src = properties.src;
      if (
        typeof src === "string" &&
        !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(src)
      ) {
        const url = new URL(src, fileUrl);
        if (!/\.(?:avif|gif|jpe?g|png|svg|tiff?|webp)$/i.test(url.pathname))
          throw new Error(`Unsupported local Markdown image: ${src}`);
        const token = `__LENSMAP_ASSET_${identity}_${assets.length}__`;
        assets.push({ path: fileURLToPath(url), token });
        properties.src = token;
      }
    }
    element.children?.forEach(visit);
  }
  visit(tree);
  return { html: processor.stringify(await processor.run(tree)), assets };
}
