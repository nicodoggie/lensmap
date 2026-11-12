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

it("retains portal and relationship metadata without relayout on metadata-only edits", () => {
  const first = layoutSemanticGraph(graph);
  const changed: SemanticGraph = {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.key === "b"
        ? {
            ...node,
            destination: { kind: "map_link", url: "other.lensmap#idea" },
          }
        : node,
    ),
    edges: graph.edges.map((edge) => ({ ...edge, type: "prevents" })),
  };
  const second = layoutSemanticGraph(changed, {
    semantic: graph,
    layout: first,
  });
  expect(second.nodes[1]).toMatchObject({
    destination: { kind: "map_link", url: "other.lensmap#idea" },
    x: first.nodes[1].x,
    y: first.nodes[1].y,
  });
  expect(second.edges[0]).toMatchObject({ type: "prevents", kind: "branch" });
});

it("invalidates placement for CSS coordinates, retaining paint-only placement", () => {
  const first = layoutSemanticGraph(graph);
  const positioned = structuredClone(graph);
  positioned.nodes[1].style = { declarations: [], x: 800, y: 400 };
  const second = layoutSemanticGraph(positioned, {
    semantic: graph,
    layout: first,
  });
  expect(second.nodes[1]).toMatchObject({ x: 800, y: 400 });
  const painted = structuredClone(positioned);
  painted.nodes[1].style?.declarations.push({
    property: "color",
    value: "red",
    important: false,
  });
  const third = layoutSemanticGraph(painted, {
    semantic: positioned,
    layout: second,
  });
  expect(third.nodes.map(({ x, y }) => ({ x, y }))).toEqual(
    second.nodes.map(({ x, y }) => ({ x, y })),
  );
});

it("projects presentation-only changes without moving centres", () => {
  const first = layoutSemanticGraph(graph);
  const presentation = {
    strokeWidth: 9,
    lineStyle: "dotted" as const,
    lineColor: "red",
    startMarker: "circle" as const,
    endMarker: "diamond" as const,
    text: "reveals",
    reverseText: "is revealed by",
  };
  const changed = {
    ...graph,
    edges: graph.edges.map((edge) => ({ ...edge, presentation })),
  };
  const next = layoutSemanticGraph(changed, { semantic: graph, layout: first });
  expect(next.edges[0]).toHaveProperty("presentation", presentation);
  expect(next.nodes).toEqual(first.nodes);
});
