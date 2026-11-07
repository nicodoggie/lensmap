import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import {
  DocumentSchema,
  DocumentSession,
  type SemanticGraph,
} from "@lensmap/document";
import { parseDocument } from "yaml";

export interface ExecutionOptions {
  /** Exact local files, compared after realpath. Admission is not sandboxing. */
  mdx?: { admittedSources: readonly string[] };
}
export type Source =
  | { kind: "local"; path: string }
  | { kind: "fetched"; url: string }
  | { kind: "compiled" };
export function canExecute(
  source: Source,
  options: ExecutionOptions,
  installed: boolean,
): boolean {
  if (!installed || !options.mdx || source.kind !== "local") return false;
  try {
    const path = realpathSync(source.path);
    return options.mdx.admittedSources.some((admitted) => {
      try {
        return realpathSync(admitted) === path;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
export interface ParsedMap {
  source: string;
  authoredFrontmatter: Record<string, unknown>;
  graph: SemanticGraph;
}
export function parseMap(source: string, uri: string): ParsedMap {
  const snapshot = new DocumentSession(uri, source).snapshot();
  if (!snapshot.valid || !snapshot.graph)
    throw new Error(
      `Invalid Lensmap ${uri}: ${JSON.stringify(snapshot.diagnostics)}`,
    );
  // Read metadata independently, never strip/re-serialize before engine parsing.
  const raw = DocumentSchema.parse(parseDocument(source).toJS());
  return {
    source,
    authoredFrontmatter: raw.frontmatter ?? {},
    graph: snapshot.graph,
  };
}
export function moduleStem(path: string): string {
  return createHash("sha256").update(path).digest("hex");
}
export function writeGenerated(path: string, content: string): boolean {
  if (existsSync(path) && readFileSync(path, "utf8") === content) return false;
  writeFileSync(path, content);
  return true;
}
