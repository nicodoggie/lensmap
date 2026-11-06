import type { SemanticGraph } from "@lensmap/document";
import { expect, it } from "vitest";
import { layoutSemanticGraph } from "./semantic-layout";

const graph: SemanticGraph = {
  nodes: [
    {
      key: "a",
      path: "nodes.0",
      title: "Alpha",
      markdown: "Alpha",
      unresolved: false,
    },
    {
      key: "b",
      path: "nodes.0.connections.0",
      title: "Beta",
      markdown: "Beta",
      unresolved: false,
    },
  ],
  edges: [
    {
      key: "ab",
      from: "a",
      to: "b",
      kind: "branch",
      path: "nodes.0.connections.0",
    },
  ],
};
it("retains computed placement across prose edits, relayouts changed authored constraints", () => {
  const first = layoutSemanticGraph(graph);
  const changed = structuredClone(graph);
  changed.nodes[0].markdown = "Alpha\nMore prose";
  const second = layoutSemanticGraph(changed, {
    semantic: graph,
    layout: first,
  });
  expect(second.nodes.map(({ x, y }) => ({ x, y }))).toEqual(
    first.nodes.map(({ x, y }) => ({ x, y })),
  );
  expect(second.nodes[0].markdown).toContain("More prose");
  changed.nodes[1].position = { x: 800, y: 400 };
  expect(
    layoutSemanticGraph(changed, { semantic: graph, layout: first }).nodes[1],
  ).toMatchObject({ x: 800, y: 400 });
});
