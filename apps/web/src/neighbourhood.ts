import type { GraphData, GraphEdge, GraphNode } from "./graph";

export interface Continuation {
  edge: GraphEdge;
  at: string;
  offset: number;
}

export interface Neighbourhood {
  nodes: GraphNode[];
  edges: GraphEdge[];
  continuations: Continuation[];
}

/** Temporary view coordinates only. Original nodes, edge identities and source stay intact. */
export function neighbourhood(
  graph: GraphData,
  key: string,
  nodeRadius = 43,
): Neighbourhood {
  const centre = graph.nodes.find((node) => node.key === key);
  if (!centre) return { nodes: [], edges: [], continuations: [] };
  const visible = new Set([key]);
  for (const edge of graph.edges) {
    if (edge.from === key) visible.add(edge.to);
    if (edge.to === key) visible.add(edge.from);
  }
  const neighbours = graph.nodes
    .filter((node) => node.key !== key && visible.has(node.key))
    .map((node) => ({
      node,
      bearing: Math.atan2(node.y - centre.y, node.x - centre.x),
    }))
    .sort((a, b) => a.bearing - b.bearing);
  const step = (2 * Math.PI) / Math.max(1, neighbours.length);
  const rotation = Math.atan2(
    neighbours.reduce((sum, n, i) => sum + Math.sin(n.bearing - i * step), 0),
    neighbours.reduce((sum, n, i) => sum + Math.cos(n.bearing - i * step), 0),
  );
  const maximum = Math.max(
    nodeRadius,
    ...graph.nodes
      .filter((n) => visible.has(n.key))
      .map((n) => n.baseRadius ?? nodeRadius),
  );
  const radius = Math.max(
    (centre.baseRadius ?? nodeRadius) + maximum + 24,
    260,
    (2 * maximum + 24) /
      (2 * Math.sin(Math.PI / Math.max(2, neighbours.length))),
  );
  const nodes = [
    { ...centre, x: 0, y: 0 },
    ...neighbours.map(({ node }, i) => ({
      ...node,
      x: radius * Math.cos(rotation + i * step),
      y: radius * Math.sin(rotation + i * step),
    })),
  ];
  const edges = graph.edges.filter(
    (edge) => visible.has(edge.from) && visible.has(edge.to),
  );
  const boundary = graph.edges.filter(
    (edge) => visible.has(edge.from) !== visible.has(edge.to),
  );
  const groups = new Map<string, GraphEdge[]>();
  for (const edge of boundary) {
    const at = visible.has(edge.from) ? edge.from : edge.to;
    const group = groups.get(at) ?? [];
    group.push(edge);
    groups.set(at, group);
  }
  const continuations = boundary.map((edge) => {
    const at = visible.has(edge.from) ? edge.from : edge.to;
    const group = groups.get(at) ?? [];
    return {
      edge,
      at,
      offset:
        group.length > 1
          ? (group.indexOf(edge) / (group.length - 1) - 0.5) * 1.25
          : 0,
    };
  });
  return { nodes, edges, continuations };
}
