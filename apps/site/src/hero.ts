import { limitMagnification } from "../../web/src/clearance";
import type { GraphData, ViewerState } from "../../web/src/embed";
import { projectPoint, type Viewport } from "../../web/src/lens";

export const heroStrength = 1.4;

/** Site view policy only; node layout is resolved from authored presentation. */
export function heroView(
  graph: GraphData,
  size: Viewport,
): { graph: GraphData; state: ViewerState } {
  // The narrow ellipse needs a broader shoulder to keep its entry points legible.
  const strength = size.width < 700 ? 1 : heroStrength;
  const displayed = graph;
  const centre =
    displayed.nodes.find((node) => node.id === "lensmap") ?? displayed.nodes[0];
  const camera = { x: centre.x, y: centre.y, zoom: 1 };
  const projected = limitMagnification(
    displayed.nodes.map((node) => ({
      ...projectPoint(node, camera, size, strength),
      baseRadius: node.baseRadius,
      key: node.key,
    })),
    43,
    strength,
  );
  const point = projected.find((node) => node.key === centre.key);
  if (!point) throw Error("The hero has no focal thought.");
  const diameter = 2 * (centre.baseRadius ?? 43) * point.scale;
  // Keep the focal bubble prominent without cropping its authored branches.
  const extentX = Math.max(
    ...projected.map(
      (point) =>
        Math.abs(point.x - size.width / 2) +
        (point.baseRadius ?? 43) * point.scale,
    ),
  );
  const extentY = Math.max(
    ...projected.map(
      (point) =>
        Math.abs(point.y - size.height / 2) +
        (point.baseRadius ?? 43) * point.scale,
    ),
  );
  camera.zoom = Math.min(
    2,
    (Math.min(size.width, size.height) * 0.76) / diameter,
    Math.max(1, size.width / 2 - 16) / extentX,
    Math.max(1, size.height / 2 - 16) / extentY,
  );
  return {
    graph: displayed,
    state: {
      selected: centre.key,
      camera,
      strength,
      overview: false,
      inNeighbourhood: false,
      neighbourhoodCamera: { x: 0, y: 0, zoom: 1 },
      neighbourhoodStrength: strength,
      returnOverview: false,
    },
  };
}

/** Destinations are authored by this site, not supplied by fetched maps. */
export function siteDestination(url: string, base: string) {
  if (url.startsWith("https://")) return { href: url, external: true };
  return { href: `${base.replace(/\/?$/, "/")}${url}`, external: false };
}
