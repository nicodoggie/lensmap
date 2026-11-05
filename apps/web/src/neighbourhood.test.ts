import { describe, expect, it } from "vitest";
import type { GraphData, GraphNode } from "./graph";
import { neighbourhood } from "./neighbourhood";

function node(key: string, x: number, y: number): GraphNode {
  return {
    key,
    title: key,
    markdown: key,
    branch: "blue",
    unresolved: false,
    x,
    y,
  };
}

const graph: GraphData = {
  nodes: [
    node("centre", 30, 40),
    { ...node("west", -900, 40), id: "west-id", branch: "amber" },
    { ...node("north", 30, -900), branch: "mint" },
    node("far", 2000, 2000),
    {
      ...node("prose", -2000, -2000),
      markdown: "A [prose reference](#centre).",
    },
  ],
  edges: [
    { key: "branch", from: "centre", to: "west", kind: "branch" },
    { key: "incoming", from: "north", to: "centre", kind: "cross" },
    { key: "between", from: "west", to: "north", kind: "cross" },
    { key: "outward", from: "west", to: "far", kind: "branch" },
    { key: "inward", from: "far", to: "north", kind: "cross" },
    { key: "loop", from: "centre", to: "centre", kind: "cross" },
    { key: "parallel", from: "centre", to: "west", kind: "cross" },
  ],
};

describe("temporary neighbourhood", () => {
  it("deduplicates bidirectional neighbours but preserves visible loops, parallel edges and boundary identity", () => {
    const view = neighbourhood(graph, "centre");
    expect(view.nodes.map((n) => n.key).sort()).toEqual([
      "centre",
      "north",
      "west",
    ]);
    expect(view.edges.map((e) => e.key)).toEqual([
      "branch",
      "incoming",
      "between",
      "loop",
      "parallel",
    ]);
    expect(view.continuations.map((c) => [c.edge.key, c.at])).toEqual([
      ["outward", "west"],
      ["inward", "north"],
    ]);
    for (const edge of [
      ...view.edges,
      ...view.continuations.map((c) => c.edge),
    ])
      expect(graph.edges).toContain(edge);
  });

  it("never changes source coordinates, keys, content, colours or topology", () => {
    const before = structuredClone(graph);
    const view = neighbourhood(graph, "centre");
    expect(graph).toEqual(before);
    expect(view).toEqual(neighbourhood(graph, "centre"));
    expect(view.nodes.find((n) => n.key === "centre")).toMatchObject({
      x: 0,
      y: 0,
    });
    for (const moved of view.nodes) {
      const source = graph.nodes.find((n) => n.key === moved.key);
      expect({ ...moved, x: source?.x, y: source?.y }).toEqual(source);
    }
  });

  it("spreads a higher-degree ring without dropping nodes and retains cyclic source-bearing order", () => {
    const spokes = Array.from({ length: 20 }, (_, i) =>
      node(
        `spoke-${i}`,
        Math.cos((i * Math.PI) / 10) * 1000,
        Math.sin((i * Math.PI) / 10) * 1000,
      ),
    );
    const source: GraphData = {
      nodes: [node("centre", 0, 0), ...spokes],
      edges: spokes.map((n) => ({
        key: n.key,
        from: "centre",
        to: n.key,
        kind: "branch",
      })),
    };
    const view = neighbourhood(source, "centre");
    const ring = view.nodes.filter((n) => n.key !== "centre");
    expect(ring).toHaveLength(spokes.length);
    const sourceOrder = spokes.map((n) => n.key);
    const start = sourceOrder.indexOf(ring[0].key);
    expect(ring.map((n) => n.key)).toEqual(
      [...sourceOrder, ...sourceOrder].slice(start, start + spokes.length),
    );
    const radii = ring.map((n) => Math.hypot(n.x, n.y));
    for (const radius of radii) expect(radius).toBeCloseTo(radii[0]);
    for (let i = 0; i < ring.length; i++) {
      const next = ring[(i + 1) % ring.length];
      expect(
        Math.hypot(next.x - ring[i].x, next.y - ring[i].y),
      ).toBeGreaterThanOrEqual(109.99);
      const cross = ring[i].x * next.y - ring[i].y * next.x;
      expect(cross).toBeGreaterThan(0);
    }
  });

  it("handles an isolated or absent thought without inventing neighbours or continuations", () => {
    const isolated = neighbourhood(graph, "prose");
    expect(isolated.nodes).toEqual([{ ...graph.nodes[4], x: 0, y: 0 }]);
    expect(isolated.edges).toEqual([]);
    expect(isolated.continuations).toEqual([]);
    expect(neighbourhood(graph, "missing")).toEqual({
      nodes: [],
      edges: [],
      continuations: [],
    });
  });
});
