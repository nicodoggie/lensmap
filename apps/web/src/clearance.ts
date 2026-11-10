import type { Point } from "./lens";

type Circle = Point & { scale: number; baseRadius?: number };

/** Limit unit-zoom circle sizes only. Centres, source layout and payloads stay exact. */
export function limitMagnification<T extends Circle>(
  points: readonly T[],
  nodeRadius: number,
  strength: number,
): T[] {
  const amount = Math.max(0, Math.min(1, strength));
  if (amount === 0 || points.length < 2)
    return points.map((point) => ({ ...point }));
  const radii = points.map(
    (point) => point.scale * (point.baseRadius ?? nodeRadius),
  );
  const minimum = radii.map((radius) => Math.min(radius, 2));
  const limited = [...radii];

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const distance = Math.hypot(
        points[i].x - points[j].x,
        points[i].y - points[j].y,
      );
      // A small context dot survives even when authored centres coincide. Such
      // positions cannot have both positive circles and guaranteed separation.
      const capacity = Math.max(minimum[i] + minimum[j], distance - 6);
      if (radii[i] + radii[j] <= capacity) continue;
      const available = Math.max(0, capacity - minimum[i] - minimum[j]);
      const extraI = radii[i] - minimum[i];
      const extraJ = radii[j] - minimum[j];
      // Smooth weights favour the larger nominal (more central) circle, without
      // an order-sensitive winner or a sudden priority flip while panning.
      const weight = radii[i] ** 2 / (radii[i] ** 2 + radii[j] ** 2);
      const shareI = Math.max(
        0,
        available - extraJ,
        Math.min(extraI, available, available * weight),
      );
      // Each pair is solved against nominal sizes. Intersecting all pair limits
      // stays conservative and independent of traversal order; no live repacking.
      limited[i] = Math.min(limited[i], minimum[i] + shareI);
      limited[j] = Math.min(limited[j], minimum[j] + available - shareI);
    }
  }

  return points.map((point, index) => ({
    ...point,
    scale:
      point.scale +
      (limited[index] / (point.baseRadius ?? nodeRadius) - point.scale) *
        amount,
  }));
}
