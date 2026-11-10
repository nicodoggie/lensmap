import { limitMagnification } from "../../web/src/clearance";
import type { GraphData, ViewerState } from "../../web/src/embed";
import { projectPoint, type Viewport } from "../../web/src/lens";

export const heroStrength = 0.55;

/** The site's narrow composition is a temporary view, not a source edit. */
export function heroView(
  graph: GraphData,
  size: Viewport,
): { graph: GraphData; state: ViewerState } {
  const portrait: Record<string, { x: number; y: number }> = {
    lensmap: { x: 0, y: 0 },
    subtitle: { x: 0, y: -390 },
    "get-started": { x: -200, y: 310 },
    documentation: { x: 0, y: 410 },
    examples: { x: 200, y: 310 },
    github: { x: 200, y: -280 },
  };
  const displayed =
    size.width < 700
      ? {
          ...graph,
          nodes: graph.nodes.map((node) => {
            const position = portrait[node.id ?? ""];
            return position ? { ...node, ...position, position } : node;
          }),
        }
      : graph;
  const centre =
    displayed.nodes.find((node) => node.id === "lensmap") ?? displayed.nodes[0];
  const camera = { x: centre.x, y: centre.y, zoom: 1 };
  const projected = limitMagnification(
    displayed.nodes.map((node) => ({
      ...projectPoint(node, camera, size, heroStrength),
      baseRadius: node.baseRadius,
      key: node.key,
    })),
    43,
    heroStrength,
  );
  const point = projected.find((node) => node.key === centre.key);
  if (!point) throw Error("The hero has no focal thought.");
  const diameter = 2 * (centre.baseRadius ?? 43) * point.scale;
  camera.zoom = Math.min(
    2,
    (Math.min(size.width, size.height) * 0.76) / diameter,
  );
  return {
    graph: displayed,
    state: {
      selected: centre.key,
      camera,
      strength: heroStrength,
      overview: false,
      inNeighbourhood: false,
      neighbourhoodCamera: { x: 0, y: 0, zoom: 1 },
      neighbourhoodStrength: heroStrength,
      returnOverview: false,
    },
  };
}

/** Destinations are authored by this site, not supplied by fetched maps. */
export function siteDestination(url: string, base: string) {
  if (url.startsWith("https://")) return { href: url, external: true };
  return { href: `${base.replace(/\/?$/, "/")}${url}`, external: false };
}
