import { expect, it } from "vitest";
import {
  DocumentSession,
  positionToOffset,
  resolveNodePresentation,
} from "./index.js";

const snapshot = (style: unknown, extra = {}) =>
  new DocumentSession(
    "test",
    JSON.stringify({
      version: "v1",
      ...extra,
      nodes: [{ summary: "Styled", style }],
    }),
  ).snapshot();
it("applies wildcard defaults to every thought once, below classes and inline styles", () => {
  const source = `version: v1
node_styles:
  special: "color: blue"
  "*": {color: red, --lensmap-scale: 2}
nodes:
  - Plain
  - id: root
    summary: Root
    classes: [special, "*", "*"]
    connections:
      - Child
      - [Nested]
      - node_id: root
      - type: map_link
        url: next.lensmap
  - summary: Inline
    style: "color: green"
`;
  const result = new DocumentSession("test", source).snapshot();
  expect(result.valid, JSON.stringify(result.diagnostics)).toBe(true);
  const nodes = result.graph?.nodes ?? [];
  expect(nodes.some((node) => node.unresolved)).toBe(true);
  expect(nodes.some((node) => node.destination)).toBe(true);
  expect(nodes.every((node) => node.style?.scale === 2)).toBe(true);
  for (const title of ["Plain", "Child", "Nested"])
    expect(
      nodes.find((node) => node.title === title)?.style?.declarations,
    ).toEqual([{ property: "color", value: "red", important: false }]);
  expect(
    nodes
      .find((node) => node.id === "root")
      ?.style?.declarations.map((d) => d.value),
  ).toEqual(["red", "blue"]);
  expect(
    nodes
      .find((node) => node.title === "Inline")
      ?.style?.declarations.map((d) => d.value),
  ).toEqual(["red", "green"]);
});

it("keeps important priority across wildcard, class and inline origins", () => {
  const all = new DocumentSession(
    "test",
    JSON.stringify({
      version: "v1",
      node_styles: {
        special: "color: blue!important; --lensmap-scale: 3!important",
        "*": "color: red!important; padding: 2px!important; --lensmap-scale: 2!important",
      },
      nodes: [
        {
          summary: "X",
          classes: ["special"],
          style:
            "color: green!important; padding: 6px; --lensmap-scale: 4!important",
        },
      ],
    }),
  ).snapshot();
  expect(all.valid).toBe(true);
  const style = all.graph?.nodes[0].style;
  expect(style?.scale).toBe(4);
  expect(
    style?.declarations
      .filter((d) => d.property === "color")
      .map((d) => d.value),
  ).toEqual(["red", "blue", "green"]);
  expect(
    style?.declarations.filter((d) => d.property === "padding").at(-1)?.value,
  ).toBe("2px");
});

it("retains conditional wildcard programs with lower normal specificity", () => {
  const result = new DocumentSession(
    "test",
    JSON.stringify({
      version: "v1",
      node_styles: {
        special: "color: blue; --lensmap-x: 30",
        "*": "color: orange; @media print {color: red!important; --lensmap-x: 15; --lensmap-scale: 2}",
      },
      nodes: [
        "Plain",
        {
          summary: "X",
          classes: ["special"],
          style: "color: green; --lensmap-scale: 3",
        },
      ],
    }),
  ).snapshot();
  expect(result.valid).toBe(true);
  const [plain, styled] = result.graph?.nodes ?? [];
  expect(plain?.style?.rules).toBeDefined();
  expect(styled?.style?.rules).toBeDefined();
  const activePlain = resolveNodePresentation(
    plain?.style?.rules ?? [],
    () => true,
  );
  const activeStyled = resolveNodePresentation(
    styled?.style?.rules ?? [],
    () => true,
  );
  expect(activePlain).toMatchObject({ scale: 2, x: 15 });
  expect(activeStyled).toMatchObject({ scale: 3, x: 30 });
  expect(activeStyled?.declarations.at(-1)).toMatchObject({
    value: "red",
    important: true,
  });
  expect(resolveNodePresentation(styled?.style?.rules ?? [])).toEqual(
    styled?.style,
  );
});

it("diagnoses invalid wildcard CSS, retains the last view and removes recovered defaults", () => {
  const source =
    'version: v1\nnode_styles:\n  "*": "@media print {color:red}"\nnodes: [Plain]\n';
  const session = new DocumentSession("test", source);
  const initial = session.snapshot();
  expect(initial.graph?.nodes[0].style?.rules).toBeDefined();
  const invalid = source.replace("color:red", "width:2px");
  const failed = session.update(invalid, 1);
  expect(failed.valid).toBe(false);
  expect(failed.graph).toEqual(initial.graph);
  const range = failed.diagnostics[0].range;
  expect(
    invalid.slice(
      positionToOffset(invalid, range.start),
      positionToOffset(invalid, range.end),
    ),
  ).toBe("width:2px");
  expect(session.update(source, 2).valid).toBe(true);
  const removed = session.update("version: v1\nnodes: [Plain]\n", 3);
  expect(removed.valid).toBe(true);
  expect(removed.graph?.nodes[0].style).toBeUndefined();
});

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
it.each([
  [
    "inline mapping",
    'version: v1\nnodes:\n  - summary: X\n    style:\n      background-color: red\n      connections: "test"\n',
  ],
  [
    "shared mapping",
    'version: v1\nnode_styles:\n  broken:\n    background-color: red\n    connections: "test"\nnodes: [X]\n',
  ],
  [
    "aliased mapping",
    'version: v1\nfrontmatter:\n  appearance: &appearance\n    background-color: red\n    connections: "test"\nnodes:\n  - summary: X\n    style: *appearance\n',
  ],
])("locates the offending declaration in an %s", (_name, source) => {
  const result = new DocumentSession("test", source).snapshot();
  expect(result.valid).toBe(false);
  const diagnostic = result.diagnostics[0];
  expect(diagnostic.message).toBe(
    "Node style: Unsupported property connections",
  );
  expect(
    source.slice(
      positionToOffset(source, diagnostic.range.start),
      positionToOffset(source, diagnostic.range.end),
    ),
  ).toBe('connections: "test"');
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

it("retains nested conditional programs and resolves only matching branches", async () => {
  const { resolveNodePresentation } = await import("./index.js");
  const s = snapshot(
    "--lensmap-x:-20; @media (width < 700px) { --lensmap-x:auto; @container (width > 200px) { color:red!important; --lensmap-y:+3 } } color:blue",
  );
  expect(s.valid, JSON.stringify(s.diagnostics)).toBe(true);
  const style = s.graph?.nodes[0].style;
  if (!style?.rules) throw new Error("Expected conditional style");
  expect(style.x).toBe(-20);
  expect(style.y).toBeUndefined();
  expect(style.rules[2].conditions).toEqual([
    { kind: "media", query: "(width < 700px)" },
    { kind: "container", query: "(width > 200px)" },
  ]);
  expect(resolveNodePresentation(style.rules, () => true)).toMatchObject({
    x: "auto",
    y: 3,
    declarations: [{ value: "blue" }, { value: "red", important: true }],
  });
  expect(resolveNodePresentation(style.rules)).toEqual(style);
});
it("retains wholly inactive programs", () => {
  expect(
    snapshot("@media print {color:red}").graph?.nodes[0].style,
  ).toMatchObject({ declarations: [], rules: [{ property: "color" }] });
});
it.each([
  "--lensmap-x:2px",
  "--lensmap-y:1e999",
  "--lensmap-x:2.",
  "@container named (width > 2px) {color:red}",
  "@container style(--x: 1) {color:red}",
  "@media print {width:2px}",
  "@media print {a {color:red}}",
])("rejects invalid responsive CSS %s", (style) =>
  expect(snapshot(style).valid).toBe(false),
);
it.each([
  "(max-width: 700px)",
  "(min-width: 700px)",
  "(min-aspect-ratio: 4/3)",
])("accepts native legacy size query %s", (query) => {
  expect(snapshot(`@container ${query} { color: red; }`).valid).toBe(true);
});

it("locates invalid inactive declarations in literal blocks", () => {
  const source =
    "version: v1\nnodes:\n  - summary: X\n    style: |\n      color: red;\n      @media print {\n        width: 2px;\n      }\n";
  const s = new DocumentSession("test", source).snapshot();
  expect(s.valid).toBe(false);
  const range = s.diagnostics[0].range;
  expect(
    source.slice(
      positionToOffset(source, range.start),
      positionToOffset(source, range.end),
    ),
  ).toBe("width: 2px");
});

it("keeps conditional class source order and inline important precedence", async () => {
  const { resolveNodePresentation } = await import("./index.js");
  const s = new DocumentSession(
    "test",
    JSON.stringify({
      version: "v1",
      node_styles: {
        a: "@media print {--lensmap-x:1!important; color:red!important}",
        b: "@media print {--lensmap-x:2!important}",
      },
      nodes: [
        {
          summary: "X",
          classes: ["b", "a"],
          style:
            "--lensmap-x:3; @media print {--lensmap-x:4!important; color:blue!important}",
        },
      ],
    }),
  ).snapshot();
  expect(s.valid).toBe(true);
  const style = s.graph?.nodes[0].style;
  if (!style?.rules) throw new Error("Expected conditional style");
  expect(style.x).toBe(3);
  expect(resolveNodePresentation(style.rules, () => true)).toMatchObject({
    x: 4,
    declarations: [{ value: "red" }, { value: "blue" }],
  });
});
it.each(["'", '"'])("maps quoted conditional diagnostics (%s)", (quote) => {
  const source = `version: v1\nnodes:\n  - summary: X\n    style: ${quote}color:red; @media print { width:2px }${quote}\n`;
  const s = new DocumentSession("test", source).snapshot();
  const range = s.diagnostics[0].range;
  expect(
    source.slice(
      positionToOffset(source, range.start),
      positionToOffset(source, range.end),
    ),
  ).toBe("width:2px");
});
it.each([
  { "--lensmap-x": -2, "--lensmap-y": "auto" },
  "--lensmap-x:-2;--lensmap-y:auto",
])("supports signed coordinates in both ordinary forms", (style) => {
  expect(snapshot(style).graph?.nodes[0].style).toEqual({
    declarations: [],
    x: -2,
    y: "auto",
  });
});

it("rejects conditional blocks hidden in mapping values", () => {
  expect(snapshot({ color: "red; @media print {}" }).valid).toBe(false);
});
it("locates escaped and folded CSS failures without guessing another declaration", () => {
  for (const source of [
    'version: v1\nnodes:\n  - summary: X\n    style: "color:red;\\n@media print {width:2px}"\n',
    "version: v1\nnodes:\n  - summary: X\n    style: >\n      color:red;\n      @media print {width:2px}\n",
    "version: v1\nfrontmatter:\n  s: &s |\n    color:red;\n    @media print {width:2px}\nnodes:\n  - summary: X\n    style: *s\n",
  ]) {
    const s = new DocumentSession("test", source).snapshot();
    expect(s.valid).toBe(false);
    const range = s.diagnostics[0].range;
    expect(
      source.slice(
        positionToOffset(source, range.start),
        positionToOffset(source, range.end),
      ),
    ).toBe("width:2px");
  }
});
