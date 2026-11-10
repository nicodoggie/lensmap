import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { isScalar, parseDocument } from "yaml";
import { parseVocabulary, type VocabularyInput } from "./vocabulary.js";
/** Root-bounded Node adapter. The browser entry deliberately never imports it. */
export async function readProjectVocabulary(
  root: string,
  buffers: ReadonlyMap<string, string> = new Map(),
): Promise<{ input: VocabularyInput; files: string[] }> {
  const config = resolve(root, "lensmap.config.json");
  const files = [config];
  let source: string | undefined;
  let offset = 0;
  try {
    const canonicalRoot = await realpath(root);
    const inside = (path: string) => {
      const rel = relative(canonicalRoot, path);
      return (
        rel === "" ||
        (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))
      );
    };
    const authorize = async (path: string): Promise<void> => {
      let ancestor = path;
      for (;;) {
        try {
          await lstat(ancestor);
          const canonical = await realpath(ancestor);
          if (!inside(canonical))
            throw new Error("Vocabulary path escapes project root");
          return;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          const parent = dirname(ancestor);
          if (parent === ancestor) throw error;
          ancestor = parent;
        }
      }
    };
    await authorize(config);
    source = buffers.get(config);
    if (source === undefined) {
      try {
        source = await readFile(config, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          return { input: {}, files };
        throw error;
      }
    }
    // JSON.parse enforces JSON syntax; YAML's JSON mode additionally detects duplicate keys.
    const json: unknown = JSON.parse(source);
    const parsed = parseDocument(source, { schema: "json", uniqueKeys: true });
    if (parsed.errors.length) throw new Error(parsed.errors[0].message);

    if (
      !json ||
      typeof json !== "object" ||
      Array.isArray(json) ||
      Object.keys(json).length !== 1 ||
      !Object.hasOwn(json, "types") ||
      typeof (json as { types?: unknown }).types !== "string" ||
      !(json as { types: string }).types.trim()
    )
      throw new Error("Config requires exactly one nonblank types path");
    const field = parsed.get("types", true);
    if (isScalar(field)) offset = field.range?.[0] ?? 0;
    const target = resolve(dirname(config), (json as { types: string }).types);
    const lexical = relative(resolve(root), target);
    if (
      lexical === ".." ||
      lexical.startsWith(`..${sep}`) ||
      isAbsolute(lexical)
    )
      throw new Error("Vocabulary path escapes project root");
    await authorize(target);
    if (!target.endsWith(".lenstypes"))
      throw new Error("Vocabulary must be a .lenstypes file");
    files.push(target);
    const text = buffers.get(target) ?? (await readFile(target, "utf8"));
    return { input: parseVocabulary(text, pathToFileURL(target).href), files };
  } catch (error) {
    return {
      input: {
        uri: pathToFileURL(config).href,
        source,
        error: error instanceof Error ? error.message : String(error),
        offset,
      },
      files,
    };
  }
}
