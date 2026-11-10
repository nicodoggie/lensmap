import { readFileSync } from "node:fs";
import { DocumentSession } from "@lensmap/document";
import { expect, test } from "vitest";
import { layoutSemanticGraph } from "../../web/src/semantic-layout";
import { heroView, siteDestination } from "./hero";

test("authored hero and example use owning semantics; responsive framing never edits their source graph", () => {
  for (const name of ["hero", "example"]) {
    const source = readFileSync(
      new URL(`./maps/${name}.lensmap`, import.meta.url),
      "utf8",
    );
    const snapshot = new DocumentSession(`site:${name}`, source).snapshot();
    expect(snapshot.valid, JSON.stringify(snapshot.diagnostics)).toBe(true);
    if (!snapshot.graph) throw Error("Missing graph");
    const graph = layoutSemanticGraph(snapshot.graph);
    const before = JSON.stringify(graph);
    if (name === "hero") {
      for (const size of [
        { width: 1440, height: 810 },
        { width: 390, height: 630 },
      ]) {
        const view = heroView(graph, size);
        expect(view.state.overview).toBe(false);
        expect(view.state.camera.zoom).toBeGreaterThan(0);
        expect(view.graph.nodes.map((node) => node.key)).toEqual(
          graph.nodes.map((node) => node.key),
        );
      }
    } else {
      expect(graph.edges.some((edge) => edge.type === "reveals")).toBe(true);
      expect(graph.nodes.some((node) => node.style?.scale === 1.4)).toBe(true);
    }
    expect(JSON.stringify(graph)).toBe(before);
  }
  expect(siteDestination("docs/", "/lensmap")).toEqual({
    href: "/lensmap/docs/",
    external: false,
  });
  expect(
    siteDestination("https://github.com/nicodoggie/lensmap", "/lensmap/")
      .external,
  ).toBe(true);
});
