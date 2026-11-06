/** biome-ignore-all lint/style/noNonNullAssertion: These fixtures require successful analysis and fail immediately otherwise. */

import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import * as engine from "./index.js";
import {
  DocumentSchema,
  DocumentSession,
  generateJSONSchema,
  offsetToPosition,
  positionToOffset,
} from "./index.js";

const source =
  "version: v1\nnodes:\n  - summary: Parent # keep\n    connections:\n      - Child\n  - Other\n";
describe("document sessions", () => {
  it("retains identities across insertion and rename and protects stale bindings", () => {
    const s = new DocumentSession("test", source, 1);
    const first = s.snapshot();
    const key = first.graph!.nodes[0].key;
    s.update(
      source
        .replace("  - summary:", "  - Inserted\n  - summary:")
        .replace("Parent", "Renamed"),
      2,
    );
    expect(
      s.snapshot().graph!.nodes.find((n) => n.title === "Renamed")!.key,
    ).toBe(key);
    s.receive("broken:", 3);
    expect(s.snapshot().pending).toBe(true);
    expect(s.definition(key)).toBeUndefined();
    s.analyze();
    expect(s.snapshot().valid).toBe(false);
    expect(s.snapshot().graphRevision).toBe(2);
    expect(first.graph!.nodes[0].title).toBe("Parent");
  });
  it("prepares minimal validated content edits preserving subtree and comments", () => {
    const s = new DocumentSession("test", source);
    const key = s.snapshot().graph!.nodes[0].key;
    const edit = s.prepareContentEdit(key, {
      summary: null,
      full_text: "A\nB",
    });
    expect(edit.source).toContain("summary: null # keep");
    expect(edit.source).toContain(
      "    connections:\n      - Child\n  - Other\n",
    );
    expect(edit.source).toContain('full_text: "A\\nB"');
    expect(s.source).toBe(source);
    s.update("version: v1\nnodes:\n  - plain\n", 2);
    expect(
      s.prepareContentEdit(s.snapshot().graph!.nodes[0].key, { full_text: "" })
        .source,
    ).toContain('- ""');
  });
  it("matches JSON schema validation for content presence and blank IDs", () => {
    const validate = new Ajv2020().compile(generateJSONSchema());
    for (const node of [
      { id: " ", summary: "x" },
      { connections: [] },
      { summary: null },
      { full_text: "" },
      { summary: "x", extra: 1 },
      { summary: "x", connections: [["child"]] },
    ]) {
      const input = { version: "v1", nodes: [node] };
      expect(validate(input)).toBe(DocumentSchema.safeParse(input).success);
    }
  });
});
describe("source safety and references", () => {
  it("keeps cross-link identities when unrelated siblings are inserted", () => {
    const before =
      "version: v1\nnodes:\n  - id: a\n    summary: A\n    connections: [{node_id: b}, {node_id: b}]\n  - id: b\n    summary: B\n";
    const s = new DocumentSession("test", before);
    const edges = s.snapshot().graph!.edges.map((edge) => edge.key);
    s.update(before.replace("  - id: a", "  - Inserted\n  - id: a"), 1);
    expect(s.snapshot().graph!.edges.map((edge) => edge.key)).toEqual(edges);
    expect(new Set(edges).size).toBe(2);
  });
  it("retains a surviving key and assigns distinct keys to copies", () => {
    const s = new DocumentSession(
      "test",
      "version: v1\nnodes:\n  - original\n  - tail\n",
    );
    const key = s.snapshot().graph!.nodes[0].key;
    s.update("version: v1\nnodes:\n  - original\n  - original\n  - tail\n", 1);
    expect(
      s
        .snapshot()
        .graph!.nodes.slice(0, 2)
        .map((n) => n.key),
    ).toContain(key);
    expect(new Set(s.snapshot().graph!.nodes.map((n) => n.key)).size).toBe(3);
  });
  it("edits block scalars without eating subtree separation", () => {
    const s = new DocumentSession(
      "test",
      "version: v1\nnodes:\n  - full_text: |\n      Old\n      text\n    connections:\n      - Child # kept\n",
    );
    const edited = s.prepareContentEdit(s.snapshot().graph!.nodes[0].key, {
      full_text: "New\ntext",
    });
    expect(edited.source).toContain("    connections:\n      - Child # kept\n");
    expect(new DocumentSession("test", edited.source).snapshot().valid).toBe(
      true,
    );
  });
  it("resolves references, recursive arrays and aliases, rejecting cyclic aliases", () => {
    const s = new DocumentSession(
      "test",
      "version: v1\nnodes:\n  - &a\n    id: target\n    summary: Target\n  - summary: Parent\n    connections:\n      - node_id: target\n      - [Child]\n  - *a\n",
    );
    // A repeated authored ID remains invalid even through an alias.
    expect(s.snapshot().valid).toBe(false);
    s.update(
      "version: v1\nnodes:\n  - id: target\n    summary: Target\n  - summary: Parent\n    connections:\n      - node_id: target\n      - [Child]\n",
      1,
    );
    expect(s.snapshot().graph!.nodes).toHaveLength(4);
    const reference = s
      .snapshot()
      .bindings.find((b) => b.kind === "reference")!;
    expect(s.locate({ line: 6, character: 10 })).toBe(reference.key);
    expect(s.highlights({ line: 6, character: 10 })).toHaveLength(2);
    s.update(
      "version: v1\nnodes:\n  - &a {summary: X, connections: [*a]}\n",
      2,
    );
    expect(s.snapshot().valid).toBe(false);
    expect(s.snapshot().diagnostics[0].message).toContain("alias cycles");
  });
  it("preserves undefined versus null presence validation", () => {
    expect(
      DocumentSchema.safeParse({
        version: "v1",
        nodes: [{ summary: undefined }],
      }).success,
    ).toBe(false);
    expect(
      DocumentSchema.safeParse({
        version: "v1",
        nodes: [{ summary: null, full_text: undefined }],
      }).success,
    ).toBe(true);
  });
});
it("handles rich null and empty content, rejecting unsupported shorthand null edits", () => {
  const s = new DocumentSession(
    "test",
    'version: v1\nnodes:\n  - summary: null\n    full_text: "" # preserved\n',
  );
  const edit = s.prepareContentEdit(s.snapshot().graph!.nodes[0].key, {
    summary: "",
    full_text: null,
  });
  expect(edit.source).toContain('summary: ""');
  expect(edit.source).toContain("full_text: null # preserved");
  const simple = new DocumentSession("test", "version: v1\nnodes: [simple]\n");
  expect(() =>
    simple.prepareContentEdit(simple.snapshot().graph!.nodes[0].key, {
      full_text: null,
    }),
  ).toThrow("cannot be edited safely");
});
it("preserves block header comments when changing multiline Markdown", () => {
  const s = new DocumentSession(
    "test",
    "version: v1\nnodes:\n  - full_text: | # retained\n      Old\n    connections: [child]\n",
  );
  const edit = s.prepareContentEdit(s.snapshot().graph!.nodes[0].key, {
    full_text: "New",
  });
  expect(edit.source).toContain(
    'full_text: "New" # retained\n    connections: [child]\n',
  );
});
it("uses UTF-16 coordinates, clamps positions and protects returned snapshots", () => {
  const text = "😀x\r\ny";
  expect(positionToOffset(text, { line: 0, character: 2 })).toBe(2);
  expect(positionToOffset(text, { line: 0, character: 99 })).toBe(3);
  expect(offsetToPosition(text, 5)).toEqual({ line: 1, character: 0 });
  const s = new DocumentSession("test", "broken:");
  expect(s.snapshot().graph).toBeNull();
  expect(s.snapshot().graphRevision).toBeNull();
  s.update(source, 1);
  const snapshot = s.snapshot();
  snapshot.graph!.nodes[0].title = "tampered";
  snapshot.bindings.length = 0;
  expect(s.snapshot().graph!.nodes[0].title).toBe("Parent");
  expect(s.snapshot().bindings.length).toBeGreaterThan(0);
});
it("accepts non-cyclic aliases without turning them into graph references", () => {
  const s = new DocumentSession(
    "test",
    "version: v1\nnodes:\n  - &a {summary: A, connections: [Child]}\n  - *a\n",
  );
  expect(s.snapshot().valid).toBe(true);
  expect(s.snapshot().graph!.nodes).toHaveLength(4);
  expect(s.snapshot().graph!.edges.every((e) => e.kind === "branch")).toBe(
    true,
  );
  const alias = s.snapshot().graph!.nodes[2];
  expect(() => s.prepareContentEdit(alias.key, { summary: "Changed" })).toThrow(
    "cannot be edited safely",
  );
});

describe("default connections", () => {
  const analyze = (nodes: unknown[]) =>
    new DocumentSession(
      "test",
      JSON.stringify({ version: "v1", nodes }),
    ).snapshot();
  it("normalizes flat types independently of structure and portal identity", () => {
    const snapshot = analyze([
      {
        full_text: "A",
        connections: [
          { type: "prevents", full_text: "B", connections: ["C"] },
          { type: "optional", summary: null, connections: ["D"] },
          { id: "portal", type: "map_link", url: "next#target" },
          { node_id: "portal" },
          { type: "precedes", node_id: "portal" },
          { type: "map_link", node_id: "portal" },
        ],
      },
    ]);
    expect(snapshot.valid).toBe(true);
    const graph = snapshot.graph!;
    expect(graph.edges.map((e) => e.type)).toEqual([
      "prevents",
      undefined,
      "optional",
      undefined,
      "map_link",
      undefined,
      "precedes",
      "map_link",
    ]);
    expect(graph.edges.slice(-3).every((e) => e.kind === "cross")).toBe(true);
    expect(graph.nodes.find((n) => n.id === "portal")).toMatchObject({
      title: "next#target",
      destination: { kind: "map_link", url: "next#target" },
    });
    expect(graph.nodes.find((n) => n.unresolved)?.title).toBe("");
  });
  it("validates structural forms with native schema parity", () => {
    const validate = new Ajv2020().compile(generateJSONSchema());
    const cases: [unknown[], boolean][] = [
      ...["connected", "precedes", "follows", "prevents", "optional"].map(
        (type) =>
          [
            [{ full_text: "A", connections: [{ type, summary: "" }] }],
            true,
          ] as [unknown[], boolean],
      ),
      [[{ type: "map_link", url: "next" }], true],
      [
        [{ type: "external_link", url: "https://example.org", summary: null }],
        true,
      ],
      ...[null, [], "Precedes", "unknown", " precedes"].map(
        (type) =>
          [
            [{ full_text: "A", connections: [{ type, full_text: "B" }] }],
            false,
          ] as [unknown[], boolean],
      ),
      [[{ type: "precedes", full_text: "A" }], false],
      [[{ type: "connected", full_text: "A" }], false],
      [[{ type: "map_link", url: " " }], false],
      [[{ type: "map_link", full_text: "A" }], false],
      [[{ full_text: "A", url: "next" }], false],
      [[{ full_text: "A", connections: [{ type: "optional" }] }], false],
      [
        [{ full_text: "A", connections: [{ node_id: "x", full_text: "B" }] }],
        false,
      ],
      [
        [
          {
            full_text: "A",
            connections: [{ node_id: "x", url: "next", type: "map_link" }],
          },
        ],
        false,
      ],
    ];
    for (const [nodes, valid] of cases) {
      const input = { version: "v1", nodes };
      expect(
        DocumentSchema.safeParse(input).success,
        JSON.stringify(input),
      ).toBe(valid);
      expect(validate(input), JSON.stringify(input)).toBe(valid);
    }
  });
  it("checks portal reference kinds without changing the last valid graph", () => {
    for (const type of ["map_link", "external_link"]) {
      expect(
        analyze([
          {
            id: "x",
            full_text: "ordinary",
            connections: [{ type, node_id: "x" }],
          },
        ]).valid,
      ).toBe(false);
    }
    expect(
      analyze([
        {
          id: "x",
          type: "map_link",
          url: "next",
          connections: [{ type: "external_link", node_id: "x" }],
        },
      ]).valid,
    ).toBe(false);
    expect(
      analyze([
        {
          id: "x",
          type: "external_link",
          url: "next",
          connections: [{ type: "external_link", node_id: "x" }],
        },
      ]).valid,
    ).toBe(true);
  });
  it("retains bindings and edits portal prose without losing destination or edge type", () => {
    const text =
      "version: v1\nnodes:\n  - full_text: A\n    connections:\n      - id: p\n        type: map_link\n        url: next\n      - type: connected\n        node_id: p\n";
    const session = new DocumentSession("test", text, 1);
    expect(session.snapshot().valid).toBe(true);
    const key = session.snapshot().graph!.nodes[1].key;
    expect(
      session.locate(offsetToPosition(text, text.indexOf("node_id: p"))),
    ).toBe(key);
    const edit = session.prepareContentEdit(key, { summary: "Portal" });
    const updated = session.update(
      edit.source.replace("url: next", "url: other"),
      2,
    );
    expect(updated.valid).toBe(true);
    expect(updated.graph!.nodes[1]).toMatchObject({
      key,
      title: "Portal",
      destination: { kind: "map_link", url: "other" },
    });
    expect(updated.graph!.edges.map((e) => e.type)).toEqual([
      "map_link",
      "connected",
    ]);
    expect(
      session.update(edit.source.replace("type: connected", "type: invalid"), 3)
        .graph,
    ).toEqual(updated.graph);
  });
});

describe("connection navigation contracts", () => {
  it("provides exact authored anchors and collision-free generated anchors", () => {
    const nodes = [
      { key: "a" },
      { key: "b", id: "thought-a" },
      { key: "c", id: " Exact / 名 " },
      { key: "d" },
    ];
    const anchors = engine.thoughtAnchors(nodes);
    expect(anchors.get("b")).toBe("thought-a");
    expect(anchors.get("c")).toBe(" Exact / 名 ");
    expect(new Set(anchors.values()).size).toBe(4);
    expect(engine.thoughtAnchors(nodes)).toEqual(anchors);
    for (const [key, anchor] of anchors)
      expect(engine.resolveThoughtAnchor(nodes, anchor)).toBe(key);
    expect(engine.resolveThoughtAnchor(nodes, "Exact / 名")).toBeUndefined();
    expect(
      engine.resolveThoughtAnchor(nodes, "%20Exact%20%2F%20名%20"),
    ).toBeUndefined();
    expect(engine.resolveThoughtAnchor(nodes, "missing")).toBeUndefined();
  });
  it("reads relationships from either endpoint", () => {
    expect(engine.connectionWording(undefined, "incoming")).toBe(
      "connected to",
    );
    expect(engine.connectionWording("connected", "outgoing")).toBe(
      "connected to",
    );
    expect(engine.connectionWording("precedes", "incoming")).toBe("follows");
    expect(engine.connectionWording("follows", "incoming")).toBe("precedes");
    expect(engine.connectionWording("prevents", "incoming")).toBe(
      "is prevented by",
    );
    expect(engine.connectionWording("prevents", "outgoing")).toBe("prevents");
    for (const type of ["optional", "map_link", "external_link"] as const) {
      expect(engine.connectionWording(type, "outgoing").length).toBeGreaterThan(
        0,
      );
      expect(engine.connectionWording(type, "incoming").length).toBeGreaterThan(
        0,
      );
    }
  });
  it("distinguishes reopened attachments and retains identity through updates", () => {
    const a = new DocumentSession("same", source, 1);
    const b = new DocumentSession("same", source, 1);
    expect(a.snapshot().attachmentId).toBeTruthy();
    expect(a.snapshot().attachmentId).not.toBe(b.snapshot().attachmentId);
    expect(a.update(source, 2).attachmentId).toBe(a.snapshot().attachmentId);
  });
});

describe("typed engine boundaries", () => {
  it("locates nested schema errors while preserving the last valid graph", () => {
    const session = new DocumentSession("test", source);
    const before = session.snapshot().graph;
    const invalid =
      "version: v1\nnodes:\n  - full_text: Parent\n    connections:\n      - type: prevent\n        full_text: Child\n";
    const snapshot = session.update(invalid, 2);
    expect(snapshot.valid).toBe(false);
    expect(snapshot.graph).toEqual(before);
    expect(snapshot.diagnostics[0].range.start.line).toBe(4);
    expect(snapshot.diagnostics[0].message).toContain("prevents");
    const ambiguous = session.update(
      invalid.replace("type: prevent", "node_id: alpha"),
      3,
    );
    expect(ambiguous.valid).toBe(false);
    expect(ambiguous.diagnostics[0].range.start.line).toBeGreaterThanOrEqual(4);
  });
  it("locates mismatched portal references at their source occurrence", () => {
    const text =
      "version: v1\nnodes:\n  - id: a\n    full_text: A\n    connections:\n      - type: map_link\n        node_id: a\n";
    const snapshot = new DocumentSession("test", text).snapshot();
    expect(snapshot.valid).toBe(false);
    expect(snapshot.diagnostics[0].range.start.line).toBe(5);
    expect(snapshot.diagnostics[0].message).toContain("map_link destination");
  });
  it("preserves explicit portal placeholders, distinct equal URLs, and parallel cycles", () => {
    const nodes = [
      {
        id: "a",
        type: "map_link",
        url: "same",
        summary: null,
        connections: [
          { type: "external_link", url: "same", full_text: "" },
          { node_id: "a", type: "precedes" },
          { node_id: "a", type: "follows" },
          { node_id: "a", type: "precedes" },
        ],
      },
    ];
    const snapshot = new DocumentSession(
      "test",
      JSON.stringify({ version: "v1", nodes }),
    ).snapshot();
    expect(snapshot.valid).toBe(true);
    expect(snapshot.graph!.nodes).toHaveLength(2);
    expect(
      snapshot.graph!.nodes.every((n) => n.title === "" && n.unresolved),
    ).toBe(true);
    expect(snapshot.graph!.nodes.map((n) => n.destination?.kind)).toEqual([
      "map_link",
      "external_link",
    ]);
    expect(new Set(snapshot.graph!.edges.map((e) => e.key)).size).toBe(4);
    expect(snapshot.graph!.edges.slice(1).every((e) => e.from === e.to)).toBe(
      true,
    );
  });
});
