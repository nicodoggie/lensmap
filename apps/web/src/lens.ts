export interface Point {
  x: number;
  y: number;
}

export interface Camera extends Point {
  zoom: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/** Camera and lens are view state; this never mutates authored world positions. */
export function projectPoint(
  point: Point,
  camera: Camera,
  viewport: Viewport,
  strength: number,
): Point & { scale: number } {
  // Tighten spatial spacing without reducing the base circle size. Nearby ideas
  // consequently stay on the larger shoulder of the lens, like an app grid.
  // Zero strength still returns the original undistorted layout for Overview.
  const blend = Math.min(1, strength);
  const spacing = 1 - blend * 0.4;
  // Zoom must not change a point's distance within the nonlinear lens profile.
  // Apply it to the completed projection instead, uniformly across the scene.
  const dx = (point.x - camera.x) * spacing;
  const dy = (point.y - camera.y) * spacing;
  // Normalize to the viewport ellipse so wide screens retain horizontal context.
  const halfWidth = Math.max(1, viewport.width / 2 - 24);
  const halfHeight = Math.max(1, viewport.height / 2 - 24);
  const distance = Math.hypot(dx / halfWidth, dy / halfHeight);
  const focusScale = 1 + strength * 0.75;
  // One perspective-like nonlinear falloff governs both placement and circle
  // size. There is no additional logarithmic distance curve or derivative-based
  // size curve that can make tiny leaves look stranded on long connectors.
  const gain = 1 - blend + (blend * focusScale) / (1 + focusScale * distance);
  // Leave room between circles in the denser lens; Overview keeps its base size.
  const circleSize = 1 - blend * 0.3;
  return {
    x: viewport.width / 2 + dx * gain * camera.zoom,
    y: viewport.height / 2 + dy * gain * camera.zoom,
    scale: camera.zoom * gain * circleSize,
  };
}

export function panCamera(camera: Camera, delta: Point): Camera {
  return {
    ...camera,
    x: camera.x - delta.x / camera.zoom,
    y: camera.y - delta.y / camera.zoom,
  };
}

export function zoomCamera(camera: Camera, factor: number): Camera {
  return { ...camera, zoom: Math.min(2, Math.max(0.3, camera.zoom * factor)) };
}

/** Fit an undistorted view, including node extents and a viewport margin. */
export function fitCamera(
  points: readonly Point[],
  size: Viewport,
  radius: number,
): Camera {
  if (points.length === 0) return { x: 0, y: 0, zoom: 1 };
  const minX = Math.min(...points.map((p) => p.x)) - radius;
  const maxX = Math.max(...points.map((p) => p.x)) + radius;
  const minY = Math.min(...points.map((p) => p.y)) - radius;
  const maxY = Math.max(...points.map((p) => p.y)) + radius;
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    zoom: Math.max(
      0.001,
      Math.min(
        (size.width - 48) / (maxX - minX),
        (size.height - 48) / (maxY - minY),
        1,
      ),
    ),
  };
}
