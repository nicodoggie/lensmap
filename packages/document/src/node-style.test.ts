import { expect, it } from "vitest";
import { DocumentSession } from "./index.js";

const snapshot = (style: unknown, extra = {}) =>
  new DocumentSession(
    "test",
    JSON.stringify({
      version: "v1",
      ...extra,
      nodes: [{ summary: "Styled", style }],
    }),
  ).snapshot();
it("projects both ordered forms and effective custom values", () => {
  for (const style of [
    "padding: 2px; padding-left: 4px; --lensmap-scale: 2; --lensmap-icon: '★'",
    {
      padding: "2px",
      "padding-left": "4px",
      "--lensmap-scale": 2,
      "--lensmap-icon": "★",
    },
  ]) {
    const s = snapshot(style);
    expect(s.valid, JSON.stringify(s.diagnostics)).toBe(true);
    expect(s.graph?.nodes[0].style).toMatchObject({
      scale: 2,
      icon: "★",
      declarations: [
        { property: "padding", value: "2px", important: false },
        { property: "padding-left", value: "4px", important: false },
      ],
    });
  }
});
it("orders equal classes by rule order, then inline, retaining important priority", () => {
  const s = new DocumentSession(
    "test",
    JSON.stringify({
      version: "v1",
      node_styles: {
        a: "color:red!important; padding:2px",
        b: "color:blue; padding-left:4px",
      },
      nodes: [
        {
          summary: "X",
          classes: ["b", "a"],
          style: "color:green; padding:3px",
        },
      ],
    }),
  ).snapshot();
  expect(s.valid, JSON.stringify(s.diagnostics)).toBe(true);
  expect(
    s.graph?.nodes[0].style?.declarations.map(
      (d) => `${d.property}:${d.value}${d.important ? "!" : ""}`,
    ),
  ).toEqual([
    "padding:2px",
    "color:blue",
    "padding-left:4px",
    "color:green",
    "padding:3px",
    "color:red!",
  ]);
});
it.each([
  "color: url(x)",
  "color:var(--x)",
  "padding:-2px",
  "color:inherit",
  "width:2px",
  "color:nope",
  "font-family:expression(x)",
  "--lensmap-scale:0",
  "--lensmap-scale:2.",
  "--lensmap-icon: url(x)",
  "color:red; @import 'x'",
  "padding: 1e999px",
])("rejects unsupported CSS %s", (style) =>
  expect(snapshot(style).valid).toBe(false),
);
it("locates failures and retains/recover last valid graph", () => {
  const good = "version: v1\nnodes:\n  - summary: X\n    style: {color: red}\n";
  const session = new DocumentSession("test", good);
  const before = session.snapshot().graph;
  const bad = session.update(good.replace("red", "url(x)"), 1);
  expect(bad.valid).toBe(false);
  expect(bad.graph).toEqual(before);
  expect(bad.diagnostics[0].range.start.line).toBe(3);
  expect(session.update(good, 2).valid).toBe(true);
});
it("rejects unknown classes, duplicate mapping keys and reference restyling", () => {
  for (const source of [
    "version: v1\nnodes: [{summary: X, classes: [missing]}]",
    "version: v1\nnodes: [{summary: X, style: {color: red, color: blue}}]",
    "version: v1\nnodes: [{id: x, summary: X, connections: [{node_id: x, style: 'color:red'}]}]",
  ])
    expect(new DocumentSession("test", source).snapshot().valid).toBe(false);
});
it("styles portals without propagation and preserves source during content edits", () => {
  const text =
    "version: v1\nnodes:\n  - type: map_link\n    url: next\n    style: 'color:red' # keep\n    connections: [Child]\n";
  const s = new DocumentSession("test", text);
  expect(s.snapshot().valid).toBe(true);
  const nodes = s.snapshot().graph?.nodes ?? [];
  expect(nodes[0].style?.declarations[0].value).toBe("red");
  expect(nodes[1].style).toBeUndefined();
  const edit = s.prepareContentEdit(nodes[0].key, { summary: "Changed" });
  expect(edit.source).toContain("style: 'color:red' # keep");
  expect(s.update(edit.source, 1).valid).toBe(true);
});
it("keeps repeated declarations, inline important priority and class isolation", () => {
  const s = new DocumentSession(
    "test",
    JSON.stringify({
      version: "v1",
      node_styles: {
        a: "--lensmap-scale:3!important;color:red!important",
        b: "--lensmap-scale:4!important",
      },
      nodes: [
        {
          summary: "A",
          classes: ["b", "a"],
          style:
            "color:blue!important;color:green!important;--lensmap-scale:auto!important",
          connections: ["Child"],
        },
      ],
    }),
  ).snapshot();
  expect(s.valid).toBe(true);
  expect(s.graph?.nodes[0].style).toEqual({
    scale: "auto",
    declarations: [
      { property: "color", value: "red", important: true },
      { property: "color", value: "blue", important: true },
      { property: "color", value: "green", important: true },
    ],
  });
  expect(s.graph?.nodes[1].style).toBeUndefined();
});
it.each([
  "color: \\69nherit",
  "font-family:'<script>'",
  "padding:calc(2px / 0)",
  "padding:2",
  "background-color:image-set(url(x) 1x)",
])("rejects unsafe/unsupported constructs %s", (style) =>
  expect(snapshot(style).valid).toBe(false),
);
it("validates unused rules at their authored source", () => {
  const s = new DocumentSession(
    "test",
    "version: v1\nnode_styles:\n  bad: 'color: url(x)'\nnodes: [X]\n",
  ).snapshot();
  expect(s.valid).toBe(false);
  expect(s.diagnostics[0].range.start.line).toBe(2);
});

it.each([
  "color: hsl(-30 50% 50%)",
  "color: rgb(-1 20 30)",
  "color: light-dark(black, white)",
  "font-style: oblique -10deg",
  "--lensmap-scale: +2",
  "--lensmap-scale: 2e+0",
  { COLOR: "red", "FONT-WEIGHT": 500 },
])("preserves native CSS grammar in supported properties: %s", (style) => {
  expect(snapshot(style).valid).toBe(true);
});

it("preserves authored class rule order even for integer-looking names", () => {
  const s = new DocumentSession(
    "test",
    'version: v1\nnode_styles:\n  "10": "color:red"\n  "2": "color:blue"\nnodes:\n  - summary: X\n    classes: ["2", "10"]\n',
  ).snapshot();
  expect(s.valid).toBe(true);
  expect(s.graph?.nodes[0].style?.declarations.map((d) => d.value)).toEqual([
    "red",
    "blue",
  ]);
});

it("does not case-fold custom property names", () => {
  expect(snapshot("--LENSMAP-SCALE:2").valid).toBe(false);
});
