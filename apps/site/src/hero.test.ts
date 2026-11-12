import { readFileSync } from "node:fs";
import { DocumentSession } from "@lensmap/document";
import { expect, test } from "vitest";
import { limitMagnification } from "../../web/src/clearance";
import { projectPoint } from "../../web/src/lens";
import { resolveGraphPresentation } from "../../web/src/responsive-style";
import { layoutSemanticGraph } from "../../web/src/semantic-layout";
import { heroView, siteDestination } from "./hero";

test("spatial focus promotes a navigation thought and lets the wordmark recede", () => {
  const source = readFileSync(
    new URL("./maps/hero.lensmap", import.meta.url),
    "utf8",
  );
  const snapshot = new DocumentSession("site:hero.lensmap", source).snapshot();
  if (!snapshot.graph) throw Error("Missing hero graph");
  const graph = layoutSemanticGraph(snapshot.graph);
  for (const size of [
    { width: 1440, height: 810 },
    { width: 1024, height: 610 },
    { width: 390, height: 630 },
  ]) {
    const resolved = resolveGraphPresentation(
      graph,
      (condition) =>
        condition.kind === "container" &&
        condition.query === "(width < 700px)" &&
        size.width < 700,
    );
    const view = heroView(resolved, size);
    const wordmark = view.graph.nodes.find((node) => node.id === "lensmap");
    const destination = view.graph.nodes.find(
      (node) => node.id === "documentation",
    );
    if (!wordmark || !destination) throw Error("Missing hero navigation");
    const radii = (focus: typeof wordmark) =>
      new Map(
        limitMagnification(
          view.graph.nodes.map((node) => ({
            ...projectPoint(
              node,
              { x: focus.x, y: focus.y, zoom: 1 },
              size,
              view.state.strength,
            ),
            baseRadius: node.baseRadius,
            key: node.key,
          })),
          43,
          view.state.strength,
        ).map((point) => [point.key, point.scale * (point.baseRadius ?? 43)]),
      );
    const before = radii(wordmark);
    const after = radii(destination);
    expect(after.get(destination.key)).toBeGreaterThan(
      2 * (before.get(destination.key) ?? 0),
    );
    expect(after.get(wordmark.key)).toBeLessThan(
      0.6 * (before.get(wordmark.key) ?? 0),
    );
    expect(after.get(destination.key)).toBeGreaterThan(
      1.25 * (after.get(wordmark.key) ?? 0),
    );
  }
});

test("narrow hero keeps Links above and subtitle destinations below their parent", () => {
  const source = readFileSync(
    new URL("./maps/hero.lensmap", import.meta.url),
    "utf8",
  );
  const snapshot = new DocumentSession("site:hero.lensmap", source).snapshot();
  if (!snapshot.valid || !snapshot.graph) throw Error("Missing valid hero");
  const graph = resolveGraphPresentation(
    layoutSemanticGraph(snapshot.graph),
    (c) => c.kind === "container",
  );
  const node = (id: string) => {
    const found = graph.nodes.find((n) => n.id === id);
    if (!found) throw Error(`Missing hero thought ${id}`);
    return found;
  };
  for (const id of ["links", "github"])
    expect(node(id).y).toBeLessThan(node("lensmap").y);
  expect(node("subtitle").y).toBeGreaterThan(node("lensmap").y);
  for (const id of ["get-started", "documentation", "examples"])
    expect(node(id).y).toBeGreaterThan(node("subtitle").y);
});

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
        { width: 1024, height: 610 },
        { width: 390, height: 630 },
      ]) {
        const resolved = resolveGraphPresentation(
          graph,
          (condition) =>
            condition.kind === "container" &&
            condition.query === "(width < 700px)" &&
            size.width < 700,
        );
        const view = heroView(resolved, size);
        expect(view.state.overview).toBe(false);
        expect(view.state.camera.zoom).toBeGreaterThan(0);
        expect(view.graph.nodes.map((node) => node.key)).toEqual(
          graph.nodes.map((node) => node.key),
        );
        expect(view.graph.edges).toBe(graph.edges);
        const { camera, strength } = view.state;
        const circles = limitMagnification(
          view.graph.nodes.map((node) => ({
            ...projectPoint(node, { ...camera, zoom: 1 }, size, strength),
            baseRadius: node.baseRadius,
            key: node.key,
          })),
          43,
          strength,
        ).map((point) => ({
          x: size.width / 2 + (point.x - size.width / 2) * camera.zoom,
          y: size.height / 2 + (point.y - size.height / 2) * camera.zoom,
          radius: (point.baseRadius ?? 43) * point.scale * camera.zoom,
        }));
        for (const [index, circle] of circles.entries()) {
          expect(circle.x - circle.radius).toBeGreaterThanOrEqual(0);
          expect(circle.y - circle.radius).toBeGreaterThanOrEqual(0);
          expect(circle.x + circle.radius).toBeLessThanOrEqual(size.width);
          expect(circle.y + circle.radius).toBeLessThanOrEqual(size.height);
          for (const other of circles.slice(index + 1)) {
            expect(
              Math.hypot(circle.x - other.x, circle.y - other.y),
            ).toBeGreaterThanOrEqual(circle.radius + other.radius - 1);
          }
        }
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
