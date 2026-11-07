import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroConfig, AstroIntegration } from "astro";
import { glob } from "astro/loaders";
import {
  canExecute,
  type ExecutionOptions,
  moduleStem,
  parseMap,
  writeGenerated,
} from "./adapter.js";
import { sanitizeMarkdown } from "./markdown.js";

export type { ExecutionOptions, ParsedMap, Source } from "./adapter.js";
export { canExecute, parseMap } from "./adapter.js";

export interface LensmapOptions extends ExecutionOptions {
  /** An Astro component module. Receives graph, authoredFrontmatter and callback thought slots. */
  contentComponent?: string;
}
/** Compose with native Astro collection schemas. Entry data is only authored frontmatter. */
export function lensmapLoader(
  options: Omit<Parameters<typeof glob>[0], "pattern"> & {
    pattern?: string | string[];
  } = {},
) {
  return glob({ ...options, pattern: options.pattern ?? "**/*.lensmap" });
}
interface EntryInput {
  contents: string;
  fileUrl: URL;
}
interface EntryType {
  extensions: string[];
  contentModuleTypes: string;
  handlePropagation: boolean;
  getEntryInfo(input: EntryInput): {
    data: Record<string, unknown>;
    body: string;
    rawData: string;
    slug?: string;
  };
  getRenderModule(input: EntryInput): Promise<{ code: string; map: null }>;
}
interface MarkdownRenderer {
  render(source: string, options: { fileURL: URL }): Promise<{ code: string }>;
}
type ConfigWithProcessor = AstroConfig & {
  markdown: AstroConfig["markdown"] & {
    processor: { createRenderer(options: unknown): Promise<MarkdownRenderer> };
  };
};
const quote = JSON.stringify;
/** Experimental private content-entry seam, deliberately limited to Astro 7.4.0. */
export default function lensmap(
  options: LensmapOptions = {},
): AstroIntegration {
  let config: ConfigWithProcessor;
  let renderer: MarkdownRenderer | undefined;
  let installedMdx = false;
  const mdxModules = new Map<string, { code: string; source: string }>();
  return {
    name: "@lensmap/astro-loader",
    hooks: {
      "astro:config:setup": (setup) => {
        const version = JSON.parse(
          readFileSync(
            new URL(import.meta.resolve("astro/package.json")),
            "utf8",
          ),
        ).version;
        if (version !== "7.4.0")
          throw new Error(
            `Lensmap experimental content seam requires Astro 7.4.0; received ${version}`,
          );
        const add = (
          setup as unknown as {
            addContentEntryType?: (entry: EntryType) => void;
          }
        ).addContentEntryType;
        if (typeof add !== "function")
          throw new Error(
            "Lensmap requires Astro 7.4.0 private addContentEntryType support",
          );
        setup.updateConfig({
          vite: {
            plugins: [
              {
                name: "lensmap-source-relative-mdx",
                enforce: "pre",
                resolveId(id) {
                  if (mdxModules.has(id)) return id;
                },
                load(id) {
                  const module = mdxModules.get(id.split("?")[0] ?? id);
                  if (!module) return;
                  this.addWatchFile(module.source);
                  return module.code;
                },
              },
            ],
          },
        });
        add({
          extensions: [".lensmap"],
          handlePropagation: true,
          contentModuleTypes:
            "declare module 'astro:content' { interface Render { '.lensmap': Promise<RenderResult>; } }",
          getEntryInfo({ contents, fileUrl }) {
            const { authoredFrontmatter: data, graph } = parseMap(
              contents,
              fileUrl.href,
            );
            return {
              data,
              body: graph.nodes.map((node) => node.markdown).join("\n\n"),
              rawData: quote(data),
              slug: typeof data.slug === "string" ? data.slug : undefined,
            };
          },
          async getRenderModule({ contents, fileUrl }) {
            const path = fileURLToPath(fileUrl);
            const { graph, authoredFrontmatter } = parseMap(
              contents,
              fileUrl.href,
            );
            const executable = canExecute(
              { kind: "local", path },
              options,
              installedMdx,
            );
            const generated = fileURLToPath(
              new URL("lensmap/", config.cacheDir),
            );
            mkdirSync(generated, { recursive: true });
            const imports: string[] = [];
            const slots: string[] = [];
            for (const [index, node] of graph.nodes.entries()) {
              if (executable) {
                // Virtual sibling module: Vite/MDX resolve imports/assets relative to the authored map.
                const id = `${path}.__lensmap_${index}.mdx`;
                mdxModules.set(id, { code: node.markdown, source: path });
                imports.push(`import Thought${index} from ${quote(id)};`);
                slots.push(
                  `<fragment slot=${quote(node.key)}>{(entry) => <Thought${index} entry={entry} authoredFrontmatter={authoredFrontmatter} />}</fragment>`,
                );
              } else {
                renderer ??= await config.markdown.processor.createRenderer({
                  ...config.markdown,
                  image: config.image,
                });
                const rendered = await renderer.render(node.markdown, {
                  fileURL: fileUrl,
                });
                const { html, assets } = await sanitizeMarkdown(
                  rendered.code,
                  fileUrl,
                  `${moduleStem(path)}_${index}`,
                );
                let expression = quote(html);
                for (const [assetIndex, asset] of assets.entries()) {
                  const name = `Asset${index}_${assetIndex}`;
                  imports.push(
                    `import ${name} from ${quote(`${asset.path}?url`)};`,
                  );
                  expression += `.replaceAll(${quote(asset.token)}, ${name})`;
                }
                slots.push(
                  `<Fragment slot=${quote(node.key)} set:html={${expression}} />`,
                );
              }
            }
            const component =
              options.contentComponent ??
              fileURLToPath(
                new URL("./components/Content.astro", import.meta.url),
              );
            const wrapper = resolve(generated, `${moduleStem(path)}.astro`);
            writeGenerated(
              wrapper,
              `---\nimport MapContent from ${quote(component)};\n${imports.join("\n")}\nconst graph = ${quote(graph)};\nconst authoredFrontmatter = ${quote(authoredFrontmatter)};\n---\n<MapContent {...Astro.props} graph={graph} authoredFrontmatter={authoredFrontmatter} executable={${executable}}>\n${slots.join("\n")}\n</MapContent>\n`,
            );
            return {
              code: `export { default as Content } from ${quote(wrapper)}; export const getHeadings = () => [];`,
              map: null,
            };
          },
        });
      },
      "astro:config:done": ({ config: resolved }) => {
        config = resolved as ConfigWithProcessor;
        installedMdx = resolved.integrations.some(
          (integration) => integration.name === "@astrojs/mdx",
        );
        if (!config.markdown.processor?.createRenderer)
          throw new Error(
            "Lensmap requires the Astro 7.4.0 Markdown processor API",
          );
        if (options.mdx && !installedMdx)
          throw new Error(
            "Lensmap MDX admission requires the host @astrojs/mdx integration",
          );
      },
    },
  };
}
