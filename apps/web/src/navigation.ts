import type { GraphData } from "./graph";
import type { Point } from "./lens";

export interface NavigationPoint extends Point {
  key: string;
}
export const directions = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
} satisfies Record<string, Point>;
export type Direction = keyof typeof directions;
export function isDirection(key: string): key is Direction {
  return key in directions;
}
const byKey = (a: NavigationPoint, b: NavigationPoint) =>
  a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
const radius = (p: Point) => Math.hypot(p.x, p.y);

/** Positions are displayed node centres relative to the fixed lens centre. */
export function centralTarget(
  points: readonly NavigationPoint[],
  region = 130,
) {
  return points
    .filter((p) => radius(p) <= region)
    .sort((a, b) => radius(a) - radius(b) || byKey(a, b))[0];
}

export function spatialTarget(
  points: readonly NavigationPoint[],
  key: string | undefined,
  direction: Direction,
) {
  const origin = points.find((p) => p.key === key) ?? { x: 0, y: 0 };
  const axis = directions[direction],
    r = radius(origin);
  const radial = r ? (origin.x * axis.x + origin.y * axis.y) / r : 0;
  return points
    .filter((p) => p.key !== key)
    .map((point) => {
      const dx = point.x - origin.x,
        dy = point.y - origin.y;
      const distance = Math.hypot(dx, dy);
      const cosine = distance ? (dx * axis.x + dy * axis.y) / distance : 0;
      const change = radius(point) - r;
      const orbitalPenalty =
        (1 - Math.abs(radial)) * Math.abs(change) +
        Math.abs(radial) * Math.max(0, -Math.sign(radial) * change);
      return {
        point,
        cosine,
        score: distance * (1 + 3 * (1 - cosine)) + 0.6 * orbitalPenalty,
      };
    })
    .filter((p) => p.cosine >= 0.5)
    .sort((a, b) => a.score - b.score || byKey(a.point, b.point))[0]?.point;
}

/** Bidirectional adjacency determines eligibility, never prose or authored nesting. */
export function connectionTarget(
  graph: GraphData,
  key: string,
  direction: Direction,
  visible: readonly NavigationPoint[] = graph.nodes,
) {
  const origin = graph.nodes.find((p) => p.key === key);
  if (!origin) return undefined;
  const at = visible.find((p) => p.key === key) ?? origin;
  const neighbours = new Set(
    graph.edges.flatMap((edge) =>
      edge.from === key ? [edge.to] : edge.to === key ? [edge.from] : [],
    ),
  );
  const axis = directions[direction];
  return graph.nodes
    .filter((p) => p.key !== key && neighbours.has(p.key))
    .map((node) => {
      // Hidden graph context remains eligible without mixing absolute coordinate frames.
      const point = visible.find((p) => p.key === node.key) ?? {
        x: at.x + node.x - origin.x,
        y: at.y + node.y - origin.y,
      };
      const dx = point.x - at.x,
        dy = point.y - at.y,
        distance = Math.hypot(dx, dy);
      return {
        node,
        distance,
        cosine: distance ? (dx * axis.x + dy * axis.y) / distance : 0,
      };
    })
    .filter((p) => p.cosine >= 0.5)
    .sort(
      (a, b) =>
        b.cosine - a.cosine || a.distance - b.distance || byKey(a.node, b.node),
    )[0]?.node;
}

export function heldDirection(keys: ReadonlySet<string>): Point {
  const x = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
  const y = Number(keys.has("ArrowDown")) - Number(keys.has("ArrowUp"));
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

/** Integral of capped acceleration, so refresh rate does not set pan speed. */
export function panDistance(elapsed: number, seconds: number, maximum: number) {
  const start = 120,
    acceleration = 900,
    ramp = (maximum - start) / acceleration;
  const integral = (t: number) => {
    const accelerated = Math.min(t, ramp);
    return (
      start * accelerated +
      (acceleration * accelerated ** 2) / 2 +
      maximum * Math.max(0, t - ramp)
    );
  };
  return integral(elapsed + seconds) - integral(elapsed);
}
