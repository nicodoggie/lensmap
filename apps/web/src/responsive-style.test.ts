import { DocumentSession } from "@lensmap/document";
import { expect, it } from "vitest";
import { resolveGraphPresentation, styleConditions } from "./responsive-style";
import { layoutSemanticGraph } from "./semantic-layout";

const source = `version: v1
nodes:
  - id: root
    summary: Root
    position: {x: 0, y: 0}
    connections:
      - id: child
        summary: Child
        style: |
          @container (width < 700px) {
            --lensmap-x: 400;
            --lensmap-y: 100;
            --lensmap-scale: 2;
          }
          @media (prefers-color-scheme: dark) { color: red; }
`;
function graph() {
  const snapshot = new DocumentSession("test", source).snapshot();
  if (!snapshot.valid || !snapshot.graph)
    throw Error(JSON.stringify(snapshot.diagnostics));
  return layoutSemanticGraph(snapshot.graph);
}

it("resolves conditional pins/radii and restores base layout without mutating source", () => {
  const input = graph();
  const before = JSON.stringify(input);
  const active = resolveGraphPresentation(input, (c) => c.kind === "container");
  expect(active.nodes[1]).toMatchObject({ x: 400, y: 100, baseRadius: 86 });
  const restored = resolveGraphPresentation(input, () => false, undefined, {
    input,
    graph: active,
  });
  expect(restored.nodes.map(({ x, y }) => ({ x, y }))).toEqual(
    input.nodes.map(({ x, y }) => ({ x, y })),
  );
  expect(JSON.stringify(input)).toBe(before);
  expect(active.nodes[1].style?.rules).toBeDefined();
});

it("retains computed world coordinates for a paint-only condition change", () => {
  const input = graph();
  const previous = structuredClone(input);
  previous.nodes[1].x += 17;
  const painted = resolveGraphPresentation(
    input,
    (c) => c.kind === "media",
    undefined,
    { input, graph: previous },
  );
  expect(painted.nodes[1].style?.declarations).toContainEqual({
    property: "color",
    value: "red",
    important: false,
  });
  expect(painted.nodes[1].x).toBe(previous.nodes[1].x);
  expect(painted.nodes[1].y).toBe(previous.nodes[1].y);
});

it("collects distinct native conditions once per viewer", () => {
  const input = graph();
  input.nodes.push({ ...input.nodes[1], key: "second-child" });
  expect(styleConditions(input)).toHaveLength(2);
});
