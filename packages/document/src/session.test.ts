/** biome-ignore-all lint/style/noNonNullAssertion: These fixtures require successful analysis and fail immediately otherwise. */
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
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
