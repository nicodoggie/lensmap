import type { GraphEdge } from "./graph";

/** Allocate view-only lanes; do not merge edge occurrences or mutate topology. */
export function edgeLanes(edges: readonly GraphEdge[]) {
  const groups = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const pair = JSON.stringify([edge.from, edge.to].sort());
    const group = groups.get(pair) ?? [];
    group.push(edge);
    groups.set(pair, group);
  }
  const lanes = new Map<
    string,
    { index: number; count: number; bend: number }
  >();
  for (const group of groups.values()) {
    group.forEach((edge, index) => {
      const offset = (index - (group.length - 1) / 2) * 60;
      lanes.set(edge.key, {
        index,
        count: group.length,
        bend: edge.from <= edge.to ? offset : -offset,
      });
    });
  }
  return lanes;
}
