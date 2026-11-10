import { mkdirSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { VocabularyInput } from "@lensmap/document";
import { readProjectVocabulary } from "@lensmap/document/project";
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
  let vocabulary: VocabularyInput = {};
  let vocabularyFiles: string[] = [];
  let generation = 0;
  const maps = new Map<string, { source: string; id: string }>();
  async function reloadVocabulary() {
    const current = ++generation;
    const root = realpathSync(fileURLToPath(config.root));
    const loaded = await readProjectVocabulary(root);
    if (current !== generation) return false;
    vocabulary = loaded.input;
    // The owning loader authorizes vocabulary targets and always retains the
    // known config filename so an invalid symlink/config can be repaired live.
    vocabularyFiles = loaded.files;
    return true;
  }
  type DevServer = Parameters<
    NonNullable<AstroIntegration["hooks"]["astro:server:setup"]>
  >[0]["server"];
  async function publishVocabulary(server: DevServer) {
    if (!(await reloadVocabulary())) return [];
    server.watcher.add(vocabularyFiles);
    for (const [uri, map] of maps) {
      try {
        const { graph } = parseMap(map.source, uri, vocabulary);
        server.ws.send("lensmap:vocabulary", {
          id: map.id,
          stale: false,
          edges: graph.edges.map(
            ({ key, from, to, kind, type, presentation }) => ({
              key,
              from,
              to,
              kind,
              type,
              presentation,
            }),
          ),
          nodes: graph.nodes.map(({ key, destination }) => ({
            key,
            destination,
          })),
        });
      } catch (error) {
        server.config.logger.error(
          error instanceof Error ? error.message : String(error),
        );
        server.ws.send("lensmap:vocabulary", { id: map.id, stale: true });
      }
    }

    // Invalidate cached server analysis for subsequent navigation without reloading the mounted island.
    for (const uri of maps.keys()) {
      for (const environment of Object.values(server.environments)) {
        for (const module of environment.moduleGraph.getModulesByFile(
          fileURLToPath(uri),
        ) ?? []) {
          environment.moduleGraph.invalidateModule(module);
        }
      }
    }
  }
  const mdxModules = new Map<string, { code: string; source: string }>();
  return {
    name: "@lensmap/astro-loader",
    hooks: {
      "astro:server:setup": ({ server }) => {
        server.watcher.add(vocabularyFiles);
        const changed = (path: string) => {
          if (vocabularyFiles.includes(path)) void publishVocabulary(server);
        };
        server.watcher.on("add", changed);
        server.watcher.on("unlink", changed);
        server.httpServer?.once("close", () => {
          server.watcher.off("add", changed);
          server.watcher.off("unlink", changed);
        });
      },
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
                resolveId(id, _importer, resolveOptions) {
                  // Keep Node's package data resolution intact during prerendering.
                  if (resolveOptions.ssr && id === "@lensmap/document")
                    return {
                      id: fileURLToPath(
                        new URL(import.meta.resolve("@lensmap/document")),
                      ),
                      external: true,
                    };

                  if (mdxModules.has(id)) return id;
                },
                async hotUpdate(context) {
                  if (!vocabularyFiles.includes(context.file)) return;
                  if (this.environment.name !== "client") return [];
                  await publishVocabulary(context.server);
                  return [];
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
              vocabulary,
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
            const mapId = moduleStem(path);
            maps.set(fileUrl.href, { source: contents, id: mapId });
            const { graph, authoredFrontmatter } = parseMap(
              contents,
              fileUrl.href,
              vocabulary,
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
              `---\nimport MapContent from ${quote(component)};\n${imports.join("\n")}\nconst graph = ${quote(graph)};\nconst authoredFrontmatter = ${quote(authoredFrontmatter)};\n---\n<MapContent {...Astro.props} graph={graph} mapId={${quote(mapId)}} authoredFrontmatter={authoredFrontmatter} executable={${executable}}>\n${slots.join("\n")}\n</MapContent>\n`,
            );
            return {
              code: `export { default as Content } from ${quote(wrapper)}; export const getHeadings = () => [];`,
              map: null,
            };
          },
        });
      },
      "astro:config:done": async ({ config: resolved }) => {
        config = resolved as ConfigWithProcessor;
        await reloadVocabulary();
        if (vocabulary.error)
          throw new Error(
            `Invalid Lensmap project vocabulary: ${vocabulary.error}`,
          );
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
