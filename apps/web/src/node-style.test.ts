import { expect, test } from "vitest";
import { fitCamera } from "./lens";
import { baseRadius } from "./node-style";

test("authored scales set the base circle independently of the lens", () => {
  expect(baseRadius({ scale: 2, declarations: [] })).toBe(86);
  expect(baseRadius({ scale: "auto", declarations: [] })).toBe(43);
});
test("fit includes each circle's own extent", () => {
  expect(
    fitCamera(
      [{ x: 0, y: 0, baseRadius: 200 }],
      { width: 248, height: 248 },
      43,
    ).zoom,
  ).toBe(0.5);
});

import { limitMagnification } from "./clearance";
import { layoutGraph } from "./document/layout";
import type { GraphData } from "./graph";
import { neighbourhood } from "./neighbourhood";

test("clearance uses heterogeneous radii without moving centres", () => {
  const circles = limitMagnification(
    [
      { x: 0, y: 0, scale: 1, baseRadius: 160 },
      { x: 220, y: 0, scale: 1, baseRadius: 80 },
    ],
    43,
    1,
  );
  expect(circles[0].scale * 160 + circles[1].scale * 80).toBeLessThanOrEqual(
    214.000001,
  );
  expect(circles.map((p) => p.x)).toEqual([0, 220]);
});
test("large circles get automatic clearance while authored pins stay exact", () => {
  const nodes = [0, 1, 2].map((i) => ({
    key: String(i),
    title: "Node",
    markdown: "Node",
    branch: "blue" as const,
    unresolved: false,
    baseRadius: 160,
    ...(i === 0 ? { position: { x: 17, y: 29 } } : {}),
  }));
  const edges: GraphData["edges"] = [
    { key: "a", from: "0", to: "1", kind: "branch" },
    { key: "b", from: "0", to: "2", kind: "branch" },
  ];
  const graph = layoutGraph(nodes, edges);
  expect([graph.nodes[0].x, graph.nodes[0].y]).toEqual([17, 29]);
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 3; j++)
      expect(
        Math.hypot(
          graph.nodes[i].x - graph.nodes[j].x,
          graph.nodes[i].y - graph.nodes[j].y,
        ),
      ).toBeGreaterThan(320);
  const local = neighbourhood(graph, "0");
  expect(Math.hypot(local.nodes[1].x, local.nodes[1].y)).toBeGreaterThan(320);
});
