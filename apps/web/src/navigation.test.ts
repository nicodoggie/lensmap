import { describe, expect, it } from "vitest";
import type { GraphData, GraphNode } from "./graph";
import {
  centralTarget,
  connectionTarget,
  heldDirection,
  panDistance,
  spatialTarget,
} from "./navigation";

const p = (key: string, x: number, y: number) => ({ key, x, y });
const node = (key: string, x: number, y: number): GraphNode => ({
  ...p(key, x, y),
  title: key,
  markdown: "",
  branch: "blue",
  unresolved: false,
});

describe("keyboard target candidates", () => {
  it("bounds central targeting, compares centres and breaks ties deterministically", () => {
    expect(centralTarget([p("far", 131, 0)])).toBeUndefined();
    expect(centralTarget([p("z", -20, 0), p("a", 20, 0)])?.key).toBe("a");
    expect(centralTarget([])).toBeUndefined();
  });
  it("softly favours similar radial bands for tangential movement, rotated with the view", () => {
    const points = [
      p("origin", 100, 0),
      p("orbital", 94, -34),
      p("inner", 70, -30),
    ];
    expect(spatialTarget(points, "origin", "ArrowUp")?.key).toBe("orbital");
    const rotated = points.map(({ key, x, y }) => p(key, -y, x));
    expect(spatialTarget(rotated, "origin", "ArrowRight")?.key).toBe("orbital");
  });
  it("favours adjacent radial progress without distant orbital jumps or wrapping", () => {
    const points = [
      p("origin", 100, 0),
      p("near", 130, 8),
      p("far", 300, 0),
      p("sideways", 101, 90),
    ];
    expect(spatialTarget(points, "origin", "ArrowRight")?.key).toBe("near");
    expect(spatialTarget(points, "far", "ArrowRight")).toBeUndefined();
    expect(
      spatialTarget([p("a", 0, 0), p("b", 1, 100)], "a", "ArrowRight"),
    ).toBeUndefined();
    expect(
      spatialTarget([p("z", 20, -10), p("a", 20, 10)], undefined, "ArrowRight")
        ?.key,
    ).toBe("a");
  });
  it("traverses incoming/outgoing explicit neighbours only, with visible geometry and hidden source fallback", () => {
    const graph: GraphData = {
      nodes: [
        node("a", 0, 0),
        node("b", 100, 0),
        node("c", 200, 0),
        node("prose", 20, 0),
      ],
      edges: [
        { key: "in", from: "b", to: "a", kind: "cross" },
        { key: "next", from: "b", to: "c", kind: "branch" },
        { key: "loop", from: "a", to: "a", kind: "cross" },
        { key: "parallel", from: "a", to: "b", kind: "branch" },
      ],
    };
    expect(connectionTarget(graph, "a", "ArrowRight")?.key).toBe("b");
    expect(
      connectionTarget(graph, "b", "ArrowRight", [p("b", 40, 10)])?.key,
    ).toBe("c");
    expect(
      connectionTarget(graph, "a", "ArrowUp", [p("a", 0, 0), p("b", 0, -60)])
        ?.key,
    ).toBe("b");
    expect(connectionTarget(graph, "a", "ArrowLeft")).toBeUndefined();
    expect(connectionTarget(graph, "missing", "ArrowRight")).toBeUndefined();
    expect(graph.nodes[1].x).toBe(100);
  });
});

describe("held pan motion", () => {
  it("normalizes diagonals and cancels opposing keys", () => {
    const direction = heldDirection(new Set(["ArrowRight", "ArrowDown"]));
    expect(Math.hypot(direction.x, direction.y)).toBeCloseTo(1);
    expect(heldDirection(new Set(["ArrowRight", "ArrowLeft"]))).toEqual({
      x: 0,
      y: 0,
    });
    expect(heldDirection(new Set())).toEqual({ x: 0, y: 0 });
  });
  it("integrates acceleration independently of frame partition and caps speed at the configured maximum", () => {
    expect(panDistance(0.2, 0.1, 600)).toBeGreaterThan(
      panDistance(0, 0.1, 600),
    );
    expect(panDistance(10, 0.1, 600)).toBeCloseTo(60);
    expect(panDistance(10, 0.1, 300)).toBeCloseTo(30);
    expect(panDistance(0, 0.2, 600)).toBeCloseTo(
      panDistance(0, 0.1, 600) + panDistance(0.1, 0.1, 600),
    );
    expect(panDistance(0, 0, 600)).toBe(0);
  });
});
