import type { SemanticGraph } from "@lensmap/document";
import { layoutGraph, type NodeDraft } from "./document/layout";
import type { Branch, GraphData } from "./graph";
import { baseRadius, positionAxis } from "./node-style";

interface PreviousLayout {
  semantic: SemanticGraph;
  layout: GraphData;
}
const branches: Branch[] = ["blue", "amber", "mint", "rose"];
const layoutKey = (graph: SemanticGraph) =>
  JSON.stringify({
    nodes: graph.nodes.map((node) => [
      node.key,
      positionAxis(node, "x"),
      positionAxis(node, "y"),
      baseRadius(node.style),
    ]),
    edges: graph.edges.map((edge) => [edge.key, edge.from, edge.to, edge.kind]),
  });

/** Layout is a view concern. Prose edits do not perturb computed placement. */
export function layoutSemanticGraph(
  graph: SemanticGraph,
  previous?: PreviousLayout,
): GraphData {
  const colours = new Map<string, Branch>();
  const children = new Map<string, string[]>();
  const nested = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.kind !== "branch") continue;
    const list = children.get(edge.from) ?? [];
    list.push(edge.to);
    children.set(edge.from, list);
    nested.add(edge.to);
  }
  const colour = (key: string, branch: Branch, depth: number) => {
    colours.set(key, branch);
    (children.get(key) ?? []).forEach((child, i) => {
      colour(
        child,
        depth === 0 ? branches[i % branches.length] : branch,
        depth + 1,
      );
    });
  };
  graph.nodes
    .filter((node) => !nested.has(node.key))
    .forEach((node, i) => {
      colour(node.key, branches[i % branches.length], 0);
    });
  const drafts: NodeDraft[] = graph.nodes.map(
    ({
      key,
      id,
      title,
      markdown,
      unresolved,
      position,
      destination,
      style,
    }) => ({
      key,
      id,
      title,
      markdown,
      unresolved,
      position,
      style,
      baseRadius: baseRadius(style),
      ...(destination ? { destination } : {}),
      branch: colours.get(key) ?? "blue",
    }),
  );
  const edges = graph.edges.map(
    ({ key, from, to, kind, type, presentation }) => ({
      key,
      from,
      to,
      kind,
      ...(type !== undefined ? { type } : {}),
      ...(presentation ? { presentation } : {}),
    }),
  );
  if (previous && layoutKey(previous.semantic) === layoutKey(graph)) {
    const points = new Map(
      previous.layout.nodes.map((node) => [node.key, node]),
    );
    return {
      nodes: drafts.map((node) => ({
        ...node,
        x: points.get(node.key)?.x ?? 0,
        y: points.get(node.key)?.y ?? 0,
      })),
      edges,
    };
  }
  return layoutGraph(drafts, edges);
}
