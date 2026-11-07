import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  DocumentSchema,
  DocumentSession,
  generateJSONSchema,
  offsetToPosition,
} from "./index.js";

const nodes = [{ summary: "A", full_text: "Body", connections: ["B"] }];
const frontmatter = {
  title: "Authored title",
  draft: false,
  sidebar: { order: 3, hidden: null },
  custom: ["one", 2, { nested: true }],
  nodes: ["metadata is not topology"],
};

describe("optional host frontmatter", () => {
  it("preserves an open metadata record without applying host defaults", () => {
    const input = { version: "v1", frontmatter, nodes };
    expect(DocumentSchema.parse(input)).toEqual(input);
    expect(DocumentSchema.parse({ version: "v1", nodes })).toEqual({
      version: "v1",
      nodes,
    });
    expect(
      DocumentSchema.parse({ version: "v1", frontmatter: {}, nodes }),
    ).toEqual({ version: "v1", frontmatter: {}, nodes });
  });

  it.each([null, [], "title", 7, true])(
    "rejects non-record metadata: %j",
    (value) => {
      expect(
        DocumentSchema.safeParse({ version: "v1", frontmatter: value, nodes })
          .success,
      ).toBe(false);
    },
  );

  it("keeps unrelated document keys and thought metadata invalid", () => {
    expect(
      DocumentSchema.safeParse({ version: "v1", frontmatters: {}, nodes })
        .success,
    ).toBe(false);
    expect(
      DocumentSchema.safeParse({
        version: "v1",
        nodes: [{ summary: "A", frontmatter: {} }],
      }).success,
    ).toBe(false);
  });

  it("keeps JSON Schema and runtime validation equivalent", () => {
    const validate = new Ajv2020().compile(generateJSONSchema());
    for (const input of [
      { version: "v1", nodes },
      { version: "v1", frontmatter, nodes },
      { version: "v1", frontmatter: {}, nodes },
      ...[null, [], "title", 7, true].map((value) => ({
        version: "v1",
        frontmatter: value,
        nodes,
      })),
      { version: "v1", frontmatters: {}, nodes },
    ]) {
      expect(validate(input)).toBe(DocumentSchema.safeParse(input).success);
    }
    expect(validate({ version: "v1", frontmatter, nodes })).toBe(true);
  });

  it("preserves source, graph identity and native locations across content edits", () => {
    const prefix = [
      "version: v1",
      "# Authored metadata must not be reserialized.",
      "frontmatter:",
      '  title: "Café" # keep quotes and comment',
      "  custom: {order: 03, enabled: false}",
      "nodes:",
      "",
    ].join("\n");
    const body = "  - summary: A\n    full_text: Body\n    connections: [B]\n";
    const source = prefix + body;
    const session = new DocumentSession("file:///host.lensmap", source);
    const snapshot = session.snapshot();
    expect(snapshot.valid).toBe(true);
    expect(session.source).toBe(source);
    const first = snapshot.graph?.nodes[0];
    expect(first).toBeDefined();
    if (!first) throw new Error("Expected the first thought.");
    const expected = new DocumentSession(
      "file:///plain.lensmap",
      `version: v1\nnodes:\n${body}`,
    ).snapshot().graph;
    expect(snapshot.graph).toEqual(expected);
    expect(session.definition(first.key)?.start).toEqual(
      offsetToPosition(source, source.indexOf("summary: A")),
    );
    const edited = session.prepareContentEdit(first.key, { full_text: "New" });
    expect(edited.source.startsWith(prefix)).toBe(true);
    expect(edited.source).toContain('full_text: "New"');
    expect(session.source).toBe(source);
    expect(session.update(edited.source, 1).valid).toBe(true);
    expect(session.snapshot().graph?.nodes[0].key).toBe(first.key);
  });
});
