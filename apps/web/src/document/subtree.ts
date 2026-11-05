import { polygonHull } from "d3-polygon";

type Vertex = [number, number];

export interface SubtreePlan {
  key: string;
  contour: Vertex[];
  children: { subtree: SubtreePlan; angle: number; distance: number }[];
}

/** Angular silhouette of the padded occupied contour, not one enclosing circle. */
function silhouette(contour: Vertex[], distance: number, padding: number) {
  let low = Infinity;
  let high = -Infinity;
  for (const [x, y] of contour) {
    const theta = Math.atan2(y, distance + x);
    const half = Math.asin(padding / Math.hypot(distance + x, y));
    low = Math.min(low, theta - half);
    high = Math.max(high, theta + half);
  }
  return { low, high };
}

/** Build once from the leaves inward in a local, forward-facing coordinate frame. */
export function planSubtree(
  key: string,
  children: SubtreePlan[],
  fullCircle: boolean,
  step: number,
  padding: number,
): SubtreePlan {
  if (children.length === 0) return { key, contour: [[0, 0]], children: [] };
  const atDistance = (distance: number) =>
    children.map((child) => silhouette(child.contour, distance, padding));
  const width = (bounds: { low: number; high: number }[]) =>
    bounds.reduce((sum, bound) => sum + bound.high - bound.low, 0);
  let distance = step;
  let bounds = atDistance(distance);
  // Spend angular room before lengthening a local link. Descendants stay in
  // their forward half-plane, so their templates cannot curl back around a parent.
  const span = fullCircle
    ? Math.PI * 2
    : Math.min(Math.PI, Math.max((Math.PI * 2) / 3, width(bounds)));
  if (width(bounds) > span) {
    let lower = distance;
    while (width(atDistance(distance)) > span) distance *= 2;
    // Find a sufficient local radius to sub-unit visual precision, without a
    // node-count/depth cap or an arbitrary fixed number of solver iterations.
    while (distance - lower > 0.5) {
      const middle = (lower + distance) / 2;
      if (width(atDistance(middle)) > span) lower = middle;
      else distance = middle;
    }
    bounds = atDistance(distance);
  }
  const required = width(bounds);
  const gap = fullCircle
    ? (span - required) / children.length
    : children.length > 1
      ? (span - required) / (children.length - 1)
      : 0;
  let cursor = fullCircle
    ? -Math.PI / 2 + bounds[0].low
    : children.length === 1
      ? -required / 2
      : -span / 2;
  const contour: Vertex[] = [[0, 0]];
  const placements = children.map((subtree, index) => {
    const bound = bounds[index];
    const angle = cursor - bound.low;
    cursor += bound.high - bound.low + gap;
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    for (const [x, y] of subtree.contour) {
      contour.push([
        (distance + x) * cos - y * sin,
        (distance + x) * sin + y * cos,
      ]);
    }
    return { subtree, angle, distance };
  });
  // D3 owns the hull calculation; thin chains retain a small contour instead of
  // being charged for every descendant or for a large circular bounding region.
  return {
    key,
    contour: polygonHull(contour) ?? contour,
    children: placements,
  };
}
