import { describe, expect, it } from "vitest";
import { parseSource } from "./parse";
import { DocumentSchema } from "./v1/schema";

function graph(source: string) {
  const result = parseSource(source);
  if (!result.ok) throw new Error(result.error);
  return result.graph;
}

describe("incomplete v1 document", () => {
  it("requires the explicit v1 version and keeps root strings and rich Markdown nodes", () => {
    expect(DocumentSchema.safeParse({ nodes: ["Thought"] }).success).toBe(
      false,
    );
    expect(DocumentSchema.safeParse({ version: "v2", nodes: [] }).success).toBe(
      false,
    );
    const document = DocumentSchema.parse({
      version: "v1",
      nodes: ["# Whole **Markdown**\n\nBody", { summary: "Short" }],
    });
    expect(document.nodes[0]).toBe("# Whole **Markdown**\n\nBody");
    expect(graph("version: v1\nnodes: []").nodes).toEqual([]);
  });

  it("normalizes recursive shorthand, forward references, cycles and convergence without prose edges", () => {
    const result = graph(`version: v1
nodes:
  - id: root
    full_text: "Root\\n\\nA [prose link](#target)."
    connections:
      - An ordinary child
      - node_id: target
  - id: target
    summary: Destination
    connections:
      - node_id: root
`);
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(3);
    const root = result.nodes.find((node) => node.id === "root");
    const target = result.nodes.find((node) => node.id === "target");
    expect(result.edges).toContainEqual(
      expect.objectContaining({
        from: root?.key,
        to: target?.key,
        kind: "cross",
      }),
    );
    expect(result.edges).toContainEqual(
      expect.objectContaining({
        from: target?.key,
        to: root?.key,
        kind: "cross",
      }),
    );
    expect(root?.markdown).toContain("[prose link](#target)");
  });

  it("preserves unresolved middle nodes and distinguishes absent content from explicit null/empty values", () => {
    const result = graph(`version: v1
nodes:
  - full_text: Parent
    connections:
      - - A
        - B
      - summary: null
        connections: [C]
      - full_text: ''
        connections: [D]
`);
    const placeholders = result.nodes.filter((node) => node.unresolved);
    expect(placeholders).toHaveLength(3);
    const middle = placeholders[0];
    expect(
      result.edges.filter((edge) => edge.from === middle.key),
    ).toHaveLength(2);
    expect(
      result.edges.some(
        (edge) => edge.from === result.nodes[0].key && edge.to === middle.key,
      ),
    ).toBe(true);
    expect(
      DocumentSchema.safeParse({
        version: "v1",
        nodes: [{ connections: ["Child"] }],
      }).success,
    ).toBe(false);
    expect(
      DocumentSchema.safeParse({
        version: "v1",
        nodes: [{ full_text: undefined }],
      }).success,
    ).toBe(false);
  });

  it("uses summary for collapsed Markdown without losing full_text or requiring IDs for positions", () => {
    const result = graph(`version: v1
nodes:
  - summary: '**Brief**'
    full_text: "A long original title\\n\\nComplete exposition."
    position: {x: -25, y: 90}
  - summary: Only a summary
`);
    expect(result.nodes[0]).toMatchObject({
      title: "**Brief**",
      markdown: "A long original title\n\nComplete exposition.",
      x: -25,
      y: 90,
    });
    expect(result.nodes[0].id).toBeUndefined();
    expect(result.nodes[1].markdown).toBe("Only a summary");
  });

  it.each([
    { version: "v1", nodes: [{ node_id: "missing", summary: "Ambiguous" }] },
    {
      version: "v1",
      nodes: [
        {
          summary: "Root",
          connections: [{ node_id: "root", full_text: "Ambiguous" }],
        },
      ],
    },
    { version: "v1", nodes: [{ full_text: 42 }] },
    { version: "v1", nodes: [{ summary: "Root", position: { x: "2", y: 3 } }] },
    {
      version: "v1",
      nodes: [{ summary: "Root", items: ["Obsolete wrapper"] }],
    },
  ])("rejects ambiguous, mistyped or unsupported node forms: %j", (input) => {
    expect(DocumentSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    [
      "version: v1\nnodes: [{id: same, summary: A}, {id: same, summary: B}]",
      "duplicate id",
    ],
    [
      "version: v1\nnodes: [{summary: A, connections: [{node_id: absent}]}]",
      "absent",
    ],
    ["version: v1\nnodes: [", "YAML"],
    ["version: v1\nversion: v1\nnodes: []", "YAML"],
    [
      "version: v1\nnodes: [&loop {summary: A, connections: [*loop]}]",
      "node_id",
    ],
  ])(
    "reports a usable error without producing a partial graph",
    (source, message) => {
      const result = parseSource(source);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain(message);
    },
  );

  it("assigns stable finite initial positions for unpositioned cyclic graphs", () => {
    const source = `version: v1
nodes:
  - id: a
    summary: A
    connections:
      - Child
      - node_id: b
  - id: b
    summary: B
    connections: [{node_id: a}]
`;
    const first = graph(source);
    expect(graph(source)).toEqual(first);
    expect(new Set(first.nodes.map((node) => `${node.x},${node.y}`)).size).toBe(
      first.nodes.length,
    );
    expect(
      first.nodes.every(
        (node) => Number.isFinite(node.x) && Number.isFinite(node.y),
      ),
    ).toBe(true);
  });
});
