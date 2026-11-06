import { expect, it } from "vitest";
import type { GraphData, GraphNode } from "./graph";
import { reconcileViewer } from "./viewer-state";

const node = (key: string, id?: string): GraphNode => ({
  key,
  id,
  x: 120,
  y: 80,
  title: key,
  markdown: "",
  branch: "blue",
  unresolved: false,
});
const previous: GraphData = {
  nodes: [node("a", "authored"), node("b")],
  edges: [],
};
const camera = { x: 17, y: -31, zoom: 1.4 };
it("retains surviving selection and camera across live layout/content changes", () => {
  expect(
    reconcileViewer(
      previous,
      { nodes: [node("b"), node("a")], edges: [] },
      "a",
      camera,
      "live",
    ),
  ).toEqual({ selected: "a", camera, reset: false });
});
it("falls back after deletion without resetting live camera, including empty graphs", () => {
  expect(
    reconcileViewer(
      previous,
      { nodes: [node("b")], edges: [] },
      "a",
      camera,
      "live",
    ),
  ).toEqual({ selected: "b", camera, reset: false });
  expect(
    reconcileViewer(previous, { nodes: [], edges: [] }, "a", camera, "live")
      .selected,
  ).toBe("");
});
it("replace matches authored identity and resets the playground camera", () => {
  expect(
    reconcileViewer(
      previous,
      { nodes: [node("other"), node("new", "authored")], edges: [] },
      "a",
      camera,
      "replace",
    ),
  ).toEqual({
    selected: "new",
    camera: { x: 120, y: 80, zoom: 0.85 },
    reset: true,
  });
});
