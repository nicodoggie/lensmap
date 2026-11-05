import { parseDocument } from "yaml";
import { z } from "zod";
import type { Branch, GraphData, GraphEdge } from "../graph";
import { layoutGraph, type NodeDraft } from "./layout";
import {
  type Connection,
  DocumentSchema,
  type LensmapDocument,
} from "./v1/schema";

export type ParseResult =
  | { ok: true; graph: GraphData }
  | { ok: false; error: string };
const branches: Branch[] = ["blue", "amber", "mint", "rose"];

/** YAML aliases may share data, but recursive object aliases are not graph edges. */
function rejectAliasCycles(
  value: unknown,
  ancestors = new WeakSet<object>(),
  checked = new WeakSet<object>(),
) {
  if (value === null || typeof value !== "object") return;
  if (ancestors.has(value))
    throw new Error(
      "YAML alias cycles are not supported; use node_id for graph cycles.",
    );
  if (checked.has(value)) return;
  ancestors.add(value);
  for (const child of Object.values(value))
    rejectAliasCycles(child, ancestors, checked);
  ancestors.delete(value);
  checked.add(value);
}

function normalize(document: LensmapDocument): GraphData {
  const nodes: NodeDraft[] = [];
  const edges: GraphEdge[] = [];
  const ids = new Map<string, string>();
  const references: { from: string; id: string; path: string }[] = [];

  function visit(
    entry: Connection,
    path: string,
    branch: Branch,
    parent?: string,
    depth = 0,
  ): void {
    if (
      typeof entry === "object" &&
      entry !== null &&
      !Array.isArray(entry) &&
      "node_id" in entry
    ) {
      if (parent) references.push({ from: parent, id: entry.node_id, path });
      return;
    }
    const content =
      typeof entry === "string"
        ? { full_text: entry }
        : Array.isArray(entry)
          ? { full_text: null, connections: entry }
          : entry;
    const key = `node:${path}`;
    const markdown = content.full_text ?? content.summary ?? "";
    const title =
      content.summary !== undefined
        ? (content.summary ?? "")
        : (content.full_text ?? "").split(/\r?\n/, 1)[0];
    nodes.push({
      key,
      id: content.id,
      title,
      markdown,
      branch,
      unresolved: title.trim() === "",
      position: content.position,
    });
    if (content.id !== undefined) {
      if (ids.has(content.id))
        throw new Error(`${path}.id: duplicate id "${content.id}".`);
      ids.set(content.id, key);
    }
    if (parent)
      edges.push({
        key: `edge:${path}`,
        from: parent,
        to: key,
        kind: "branch",
      });
    content.connections?.forEach((child, index) => {
      visit(
        child,
        `${path}.connections.${index}`,
        depth === 0 ? branches[index % branches.length] : branch,
        key,
        depth + 1,
      );
    });
  }
  document.nodes.forEach((node, index) => {
    visit(node, `nodes.${index}`, branches[index % branches.length]);
  });
  for (const reference of references) {
    const target = ids.get(reference.id);
    if (!target)
      throw new Error(
        `${reference.path}.node_id: no node has id "${reference.id}".`,
      );
    edges.push({
      key: `edge:${reference.path}`,
      from: reference.from,
      to: target,
      kind: "cross",
    });
  }
  return layoutGraph(nodes, edges);
}

export function parseSource(source: string): ParseResult {
  try {
    const yaml = parseDocument(source, { uniqueKeys: true });
    const problems = [...yaml.errors, ...yaml.warnings];
    if (problems.length)
      return {
        ok: false,
        error: `YAML: ${problems.map((problem) => problem.message).join("\n")}`,
      };
    const input: unknown = yaml.toJS();
    rejectAliasCycles(input);
    const validated = DocumentSchema.safeParse(input);
    if (!validated.success)
      return {
        ok: false,
        error: `Incomplete v1 schema:\n${z.prettifyError(validated.error)}`,
      };
    return { ok: true, graph: normalize(validated.data) };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "The document could not be parsed.",
    };
  }
}
