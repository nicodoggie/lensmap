import { expect, it } from "vitest";
import type { GraphData, GraphNode } from "./graph";
import { connectionCandidates, stepConnectionChoice } from "./navigation";

const n = (key: string, x: number, y: number): GraphNode => ({
  key,
  x,
  y,
  title: key,
  markdown: "",
  branch: "blue",
  unresolved: false,
});
const graph: GraphData = {
  nodes: [
    n("a", 0, 0),
    n("b", 100, 0),
    n("c", 150, 20),
    n("d", -100, 0),
    n("prose", 20, 0),
  ],
  edges: [
    { key: "branch", from: "a", to: "b", kind: "branch" },
    { key: "incoming", from: "b", to: "a", kind: "cross" },
    { key: "cross", from: "a", to: "c", kind: "cross" },
    { key: "left", from: "d", to: "a", kind: "cross" },
    { key: "loop", from: "a", to: "a", kind: "cross" },
  ],
};

it("returns whole directional groups with original route identities, kinds and directions", () => {
  const before = structuredClone(graph);
  const candidates = connectionCandidates(graph, "a", "ArrowRight");
  expect(candidates.map((c) => c.node.key)).toEqual(["b", "c"]);
  expect(
    candidates[0].routes.map((r) => [r.edge.key, r.edge.kind, r.direction]),
  ).toEqual([
    ["branch", "branch", "outgoing"],
    ["incoming", "cross", "incoming"],
  ]);
  expect(candidates[0].routes[0].edge).toBe(graph.edges[0]);
  expect(candidates[0].node).toBe(graph.nodes[1]);
  expect(graph).toEqual(before);
});

it("freezes origin/bearings, cycles the same group and resets on direction changes including empty groups", () => {
  const first = stepConnectionChoice(graph, "a", "ArrowRight", graph.nodes);
  const changed = graph.nodes.map((p) => ({ ...p, x: -p.x }));
  const second = stepConnectionChoice(graph, "b", "ArrowRight", changed, first);
  expect(second.origin).toBe("a");
  expect(second.candidates[second.index].node.key).toBe("c");
  expect(second.positions).toEqual(first.positions);
  const wrapped = stepConnectionChoice(
    graph,
    "c",
    "ArrowRight",
    changed,
    second,
  );
  expect(wrapped.candidates[wrapped.index].node.key).toBe("b");
  const left = stepConnectionChoice(graph, "c", "ArrowLeft", changed, wrapped);
  expect(left.origin).toBe("a");
  expect(left.candidates.map((c) => c.node.key)).toEqual(["d"]);
  const empty = stepConnectionChoice(graph, "d", "ArrowUp", changed, left);
  expect(empty.candidates).toEqual([]);
  expect(
    stepConnectionChoice(graph, "d", "ArrowUp", changed, empty).index,
  ).toBe(0);
  const right = stepConnectionChoice(graph, "d", "ArrowRight", changed, empty);
  expect(right.candidates[right.index].node.key).toBe("b");
  expect(first.index).toBe(0);
});
