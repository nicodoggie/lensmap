import { describe, expect, it } from "vitest";
import { DocumentSession, parseVocabulary } from "./index.js";

describe("custom vocabulary transaction", () => {
  it("layers inherited presentation and preserves identities on vocabulary-only recovery", () => {
    const source =
      "version: v1\nconnection_types:\n  child: {extends: prevents}\nnodes:\n - full_text: A\n   connections:\n    - {type: child, full_text: B}\n";
    const session = new DocumentSession(
      "map",
      source,
      1,
      parseVocabulary("connection_types:\n  prevents: {stroke-width: 4px}"),
    );
    const first = session.snapshot();
    expect(first.valid).toBe(true);
    expect(first.graph?.edges[0].presentation?.strokeWidth).toBe("4px");
    const bad = session.setVocabulary(
      parseVocabulary("connection_types:\n  prevents: {extends: missing}"),
    );
    expect(bad.valid).toBe(false);
    expect(bad.graph).toEqual(first.graph);
    expect(bad.graphGeneration).toBe(first.graphGeneration);
    const next = session.setVocabulary(
      parseVocabulary("connection_types:\n  prevents: {stroke-width: 0}"),
    );
    expect(next.valid).toBe(true);
    expect(next.graph?.nodes.map((n) => n.key)).toEqual(
      first.graph?.nodes.map((n) => n.key),
    );
    expect(next.graphGeneration).toBeGreaterThan(first.graphGeneration ?? 0);
  });
  it.each(["-1px", "var(--x)", "red", "calc(1px + 2deg)", "inherit", "url(x)"])(
    "rejects width %s",
    (value) => {
      expect(
        parseVocabulary(
          `connection_types:\n  custom: {stroke-width: '${value}'}`,
        ).error,
      ).toBeTruthy();
    },
  );
  it.each([
    "2px",
    "1%",
    "0.2em",
    "calc(1px + 2%)",
    "min(1em, 3px)",
    "clamp(0px, 1vw, 4px)",
  ])("accepts width %s", (value) => {
    expect(
      parseVocabulary(`connection_types:\n  custom: {stroke-width: '${value}'}`)
        .error,
    ).toBeUndefined();
  });
});

describe("resolution and source compatibility", () => {
  const map = (
    declarations: string,
    body = "- full_text: A\n  connections:\n    - {type: custom, full_text: B}",
  ) => `version: v1\nconnection_types:\n${declarations}\nnodes:\n${body}\n`;
  it.each([
    "  custom: {extends: missing}",
    "  custom: {extends: custom}",
    "  custom: {extends: second}\n  second: {extends: custom}",
    "  external_link: {extends: connected}\n  custom: {}",
    "  custom: {text: forward}",
    "  custom: {line-color: null}",
    "  custom: {unknown: true}",
    "  custom: {}\n  custom: {}",
  ])("rejects invalid declarations: %s", (declarations) => {
    expect(new DocumentSession("map", map(declarations)).snapshot().valid).toBe(
      false,
    );
  });
  it("merges raw fields before inheritance and supports exact prototype-like names", () => {
    const shared = parseVocabulary(
      "connection_types:\n  parent: {stroke-width: 3px}\n  custom: {extends: parent, stroke-width: 2px, text: supports, reverse_text: supported by}\n  constructor: {}\n  __proto__: {}",
    );
    const session = new DocumentSession(
      "map",
      map("  parent: {stroke-width: 9px}\n  custom: {end-marker: none}"),
      0,
      shared,
    );
    expect(session.snapshot().graph?.edges[0].presentation).toMatchObject({
      strokeWidth: "2px",
      text: "supports",
      endMarker: "none",
    });
    expect(
      Object.hasOwn(session.snapshot().vocabulary ?? {}, "__proto__"),
    ).toBe(true);
    expect(session.snapshot().vocabulary?.constructor).toBeTruthy();
  });
  it("preserves untyped presentation and inherited portal capabilities", () => {
    const source = map(
      "  custom: {extends: external_link}\n  connected: {stroke-width: 0}",
      '- full_text: A\n  connections:\n    - {type: custom, url: "https://example.org", id: link}\n    - plain\n    - {type: custom, node_id: link}',
    );
    const snapshot = new DocumentSession("map", source).snapshot();
    expect(snapshot.valid).toBe(true);
    expect(snapshot.graph?.nodes[1].destination?.kind).toBe("external_link");
    expect(snapshot.graph?.edges[1].presentation).toBeUndefined();
    expect(
      new DocumentSession(
        "map",
        map("  custom: {extends: map_link}", "- {type: custom, url: next}"),
      ).snapshot().valid,
    ).toBe(true);
    expect(
      new DocumentSession(
        "map",
        map(
          "  custom: {extends: map_link}",
          "- full_text: A\n  connections:\n    - {id: ordinary, full_text: B}\n    - {node_id: ordinary, type: custom}",
        ),
      ).snapshot().valid,
    ).toBe(false);
  });
  it.each([
    "red",
    "#aabbcc",
    "rgb(10 20 30 / 50%)",
    "hsl(20 40% 30%)",
    "currentColor",
    "transparent",
    "oklch(50% .2 30)",
    "color(display-p3 1 0 0)",
    "light-dark(black, white)",
    "oklch(none 0.2 none)",
    "rgb(calc(1px / 1px) 0 0)",
  ])("accepts colour %s", (color) => {
    expect(
      parseVocabulary(`connection_types:\n  custom: {line-color: '${color}'}`)
        .error,
    ).toBeUndefined();
  });
  it.each([
    "var(--c)",
    "url(#paint)",
    "inherit",
    "color(--profile 1 0 0)",
    "red; color: blue",
  ])("rejects colour %s", (color) => {
    expect(
      parseVocabulary(`connection_types:\n  custom: {line-color: '${color}'}`)
        .error,
    ).toBeTruthy();
  });
});

it.each([
  "calc(1px * 2px)",
  "calc(1px + 2)",
  "calc(1s)",
  "min(1px, 2deg)",
  "calc(1px +)",
  "calc(NaN * 1px)",
  "calc(1e999 * 1px)",
])("rejects invalid math %s", (width) => {
  expect(
    parseVocabulary(`connection_types:\n  c: {stroke-width: '${width}'}`).error,
  ).toBeTruthy();
});
it("prepares source edits with the same shared vocabulary", () => {
  const session = new DocumentSession(
    "map",
    "version: v1\nnodes:\n - full_text: A\n   connections:\n    - type: custom\n      full_text: B\n",
    1,
    parseVocabulary("connection_types: {custom: {}}"),
  );
  const edited = session.prepareContentEdit(
    session.snapshot().graph?.nodes[1].key ?? "missing",
    { summary: "Updated" },
  );
  expect(edited.source).toContain("custom");
  expect(edited.source).toContain("Updated");
});
it("keeps both portal defaults unmarked and locates unknown reference types at their occurrence", () => {
  const session = new DocumentSession(
    "map",
    "version: v1\nnodes:\n - full_text: A\n   connections:\n    - {type: external_link, url: 'https://example.org'}\n    - {type: map_link, url: next.lensmap}\n",
  );
  expect(
    session.snapshot().graph?.edges.map((edge) => edge.presentation?.endMarker),
  ).toEqual(["none", "none"]);
  const invalid = new DocumentSession(
    "map",
    "version: v1\nnodes:\n - id: a\n   full_text: A\n   connections:\n    - {node_id: a, type: missing}\n",
  ).snapshot();
  expect(invalid.valid).toBe(false);
  expect(invalid.diagnostics[0].range.start.line).toBe(5);
});
it.each(["rgb(calc(1px) 0 0)", "rgb(calc(1deg) 0 0)", "hsl(0 calc(1deg) 50%)"])(
  "rejects colour channel dimensions %s",
  (color) => {
    expect(
      parseVocabulary(`connection_types:\n  c: {line-color: '${color}'}`).error,
    ).toBeTruthy();
  },
);
