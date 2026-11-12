import { describe, expect, it } from "vitest";
import type { GraphData } from "../graph";
import { parseSource } from "./parse";

function parse(source: string): GraphData {
  const result = parseSource(source);
  if (!result.ok) throw new Error(result.error);
  return result.graph;
}

const star = `version: v1
nodes:
  - id: root
    summary: Root
    connections:
      - {id: north, summary: First}
      - {id: east, summary: Second}
      - {id: south, summary: Third}
      - {id: west, summary: Fourth}
`;

function node(graph: GraphData, id: string) {
  const found = graph.nodes.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing test node ${id}.`);
  return found;
}

describe("default radial branch layout", () => {
  it("places siblings around their parent clockwise in authored order, deterministically", () => {
    const graph = parse(star);
    const root = node(graph, "root");
    expect(node(graph, "north").y).toBeLessThan(root.y - 80);
    expect(node(graph, "east").x).toBeGreaterThan(root.x + 80);
    expect(node(graph, "south").y).toBeGreaterThan(root.y + 80);
    expect(node(graph, "west").x).toBeLessThan(root.x - 80);
    expect(parse(star)).toEqual(graph);
  });

  it("fans grandchildren outward around their own parent with local branch lengths", () => {
    const graph = parse(`version: v1
nodes:
  - id: root
    summary: Root
    connections:
      - id: upper
        summary: Upper
        connections:
          - {id: upper-left, summary: First upper}
          - {id: upper-right, summary: Second upper}
      - id: lower
        summary: Lower
        connections:
          - {id: lower-right, summary: First lower}
          - {id: lower-left, summary: Second lower}
`);
    const root = node(graph, "root");
    const upper = node(graph, "upper");
    const lower = node(graph, "lower");
    expect(node(graph, "upper-left").x).toBeLessThan(upper.x);
    expect(node(graph, "upper-right").x).toBeGreaterThan(upper.x);
    expect(node(graph, "lower-right").x).toBeGreaterThan(lower.x);
    expect(node(graph, "lower-left").x).toBeLessThan(lower.x);
    for (const id of ["upper-left", "upper-right"])
      expect(node(graph, id).y).toBeLessThan(upper.y);
    for (const id of ["lower-right", "lower-left"])
      expect(node(graph, id).y).toBeGreaterThan(lower.y);
    const byKey = new Map(graph.nodes.map((entry) => [entry.key, entry]));
    const rootStep = Math.hypot(upper.x - root.x, upper.y - root.y);
    for (const edge of graph.edges) {
      const parent = byKey.get(edge.from);
      const child = byKey.get(edge.to);
      if (!parent || !child) throw new Error("Missing test edge endpoint.");
      const distance = Math.hypot(child.x - parent.x, child.y - parent.y);
      expect(distance).toBeGreaterThan(rootStep * 0.75);
      expect(distance).toBeLessThan(rootStep * 1.5);
    }
  });

  it("preserves explicit positions and keeps multiple authored roots independent", () => {
    const graph = parse(`version: v1
nodes:
  - id: pinned-root
    summary: Pinned root
    position: {x: 1000, y: 500}
    connections:
      - id: pinned-child
        summary: Pinned child
        position: {x: 1200, y: 500}
        connections:
          - {id: child-a, summary: A}
          - {id: child-b, summary: B}
  - id: other-root
    summary: Other root
    connections: [{node_id: pinned-root}]
`);
    expect(node(graph, "pinned-root")).toMatchObject({ x: 1000, y: 500 });
    expect(node(graph, "pinned-child")).toMatchObject({ x: 1200, y: 500 });
    expect(node(graph, "child-a").x).toBeGreaterThan(1200);
    expect(node(graph, "child-b").x).toBeGreaterThan(1200);
    const other = node(graph, "other-root");
    expect(Math.hypot(other.x - 1000, other.y - 500)).toBeGreaterThan(300);
    expect(
      graph.nodes.every(
        (entry) => Number.isFinite(entry.x) && Number.isFinite(entry.y),
      ),
    ).toBe(true);
  });

  it("does not use cycles or converging reference edges to change the authored hierarchy", () => {
    const original = parse(star);
    const references = parse(
      star.replace(
        "- {id: north, summary: First}",
        "- id: north\n        summary: First\n        connections: [{node_id: root}, {node_id: east}]",
      ),
    );
    expect(references.nodes).toEqual(original.nodes);
    expect(
      references.edges.filter((edge) => edge.kind === "cross"),
    ).toHaveLength(2);
  });

  it("resolves CSS coordinate axes before layout and releases legacy pins with auto", () => {
    const document = (position?: { x: number; y: number }) =>
      JSON.stringify({
        version: "v1",
        nodes: [
          {
            id: "root",
            summary: "Root",
            position: { x: 0, y: 0 },
            connections: [
              {
                id: "child",
                summary: "Child",
                position,
                style: { "--lensmap-x": 900, "--lensmap-y": "auto" },
              },
            ],
          },
        ],
      });
    const automatic = node(parse(document()), "child");
    const released = node(parse(document({ x: 1200, y: 500 })), "child");
    expect(released).toMatchObject({ x: 900, y: automatic.y });
    expect(released.y).not.toBe(500);
    const fallback = parse(
      document({ x: 1200, y: 500 }).replace(
        '"--lensmap-x":900,"--lensmap-y":"auto"',
        '"--lensmap-y":-300',
      ),
    );
    expect(node(fallback, "child")).toMatchObject({ x: 1200, y: -300 });
  });

  it("gives a broad subtree more angular room than an equally populous narrow chain", () => {
    const graph = parse(
      JSON.stringify({
        version: "v1",
        nodes: [
          {
            id: "root",
            summary: "Root",
            connections: [
              {
                id: "wide",
                summary: "Broad fork",
                connections: ["One", "Two", "Three", "Four"],
              },
              {
                id: "chain",
                summary: "Narrow chain",
                connections: [
                  {
                    summary: "One",
                    connections: [
                      {
                        summary: "Two",
                        connections: [
                          { summary: "Three", connections: ["Four"] },
                        ],
                      },
                    ],
                  },
                ],
              },
              { id: "leaf", summary: "Leaf" },
            ],
          },
        ],
      }),
    );
    const root = node(graph, "root");
    const bearing = (id: string) => {
      const point = node(graph, id);
      return Math.atan2(point.y - root.y, point.x - root.x);
    };
    const tau = Math.PI * 2;
    const gap = (from: string, to: string) =>
      (bearing(to) - bearing(from) + tau) % tau;
    expect(gap("wide", "chain")).toBeGreaterThan(gap("chain", "leaf") + 0.05);
  });

  it("keeps neighbouring broad subtree contours from interleaving around their parent", () => {
    const graph = parse(
      JSON.stringify({
        version: "v1",
        nodes: [
          {
            id: "root",
            summary: "Root",
            connections: Array.from({ length: 4 }, (_, branch) => ({
              summary: `Branch ${branch}`,
              connections: Array.from({ length: 2 }, (_, fork) => ({
                summary: `Fork ${branch}-${fork}`,
                connections: Array.from(
                  { length: 4 },
                  (_, leaf) => `Leaf ${branch}-${fork}-${leaf}`,
                ),
              })),
            })),
          },
        ],
      }),
    );
    const root = node(graph, "root");
    const byKey = new Map(graph.nodes.map((entry) => [entry.key, entry]));
    const edges = graph.edges.filter((edge) => edge.kind === "branch");
    const branches = edges
      .filter((edge) => edge.from === root.key)
      .map((edge) => edge.to);
    const first = byKey.get(branches[0]);
    if (!first) throw new Error("Missing first test branch.");
    const start = Math.atan2(first.y - root.y, first.x - root.x);
    const tau = Math.PI * 2;
    const contours = branches.map((key) => {
      const branch = byKey.get(key);
      if (!branch) throw new Error("Missing test branch.");
      const heading = Math.atan2(branch.y - root.y, branch.x - root.x);
      const base = (heading - start + tau) % tau;
      const pending = [key];
      let low = Infinity,
        high = -Infinity;
      while (pending.length) {
        const current = pending.pop();
        const point = current ? byKey.get(current) : undefined;
        if (!point) throw new Error("Missing test descendant.");
        const dx = point.x - root.x,
          dy = point.y - root.y;
        const theta = Math.atan2(dy, dx) - heading;
        const relative = Math.atan2(Math.sin(theta), Math.cos(theta));
        const half = Math.asin(43 / Math.hypot(dx, dy));
        low = Math.min(low, base + relative - half);
        high = Math.max(high, base + relative + half);
        pending.push(
          ...edges
            .filter((edge) => edge.from === current)
            .map((edge) => edge.to),
        );
      }
      return { low, high };
    });
    contours.forEach((contour, index) => {
      const next = contours[(index + 1) % contours.length];
      const nextLow = next.low + (index === contours.length - 1 ? tau : 0);
      expect(contour.high).toBeLessThanOrEqual(nextLow + 1e-6);
    });
  });
});
