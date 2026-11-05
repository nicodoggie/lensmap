import { describe, expect, it } from "vitest";
import { fitCamera, panCamera, projectPoint, zoomCamera } from "./lens";

const size = { width: 900, height: 600 };
const camera = { x: 0, y: 0, zoom: 1 };

describe("spatial lens", () => {
  it("keeps the focal point fixed and makes nearby nodes larger than peripheral ones", () => {
    const centre = projectPoint({ x: 0, y: 0 }, camera, size, 1.2);
    const near = projectPoint({ x: 80, y: 0 }, camera, size, 1.2);
    const far = projectPoint({ x: 400, y: 0 }, camera, size, 1.2);
    expect(centre.x).toBe(450);
    expect(centre.y).toBe(300);
    expect(centre.scale).toBeGreaterThan(near.scale);
    expect(near.scale).toBeGreaterThan(far.scale);
    const frame = { width: 1016, height: 670 };
    const normalCamera = { ...camera, zoom: 0.85 };
    const focus = projectPoint({ x: 0, y: 0 }, normalCamera, frame, 1.1);
    const neighbour = projectPoint(
      { x: 240, y: -120 },
      normalCamera,
      frame,
      1.1,
    );
    expect(
      Math.hypot(neighbour.x - focus.x, neighbour.y - focus.y),
    ).toBeLessThan(150);
    expect(neighbour.scale).toBeGreaterThan(focus.scale / 3);
  });

  it("preserves radial ordering continuously without changing source positions", () => {
    const point = Object.freeze({ x: 160, y: 70 });
    const original = projectPoint(point, camera, size, 1.2);
    const next = projectPoint(point, { ...camera, x: 0.001 }, size, 1.2);
    expect(Math.abs(original.x - next.x)).toBeLessThan(0.01);
    let previous = -1;
    for (let x = 0; x <= 2000; x += 20) {
      const projected = projectPoint({ x, y: 0 }, camera, size, 1.2);
      expect(projected.x).toBeGreaterThan(previous);
      previous = projected.x;
    }
  });

  it("turns lens strength zero into a uniform undistorted projection", () => {
    const a = projectPoint({ x: 100, y: 80 }, camera, size, 0);
    const b = projectPoint({ x: 200, y: 160 }, camera, size, 0);
    expect(b.x - 450).toBeCloseTo(2 * (a.x - 450));
    expect(a.scale).toBe(b.scale);
  });

  it("zooms every point and circle uniformly after lens deformation", () => {
    const baseCamera = { x: 90, y: -40, zoom: 0.8 };
    const factor = 1.5;
    const zoomedCamera = zoomCamera(baseCamera, factor);
    for (const point of [
      { x: 90, y: -40 },
      { x: 170, y: 20 },
      { x: 490, y: -210 },
      { x: 2350, y: 1640 },
    ]) {
      const before = projectPoint(point, baseCamera, size, 1.1);
      const after = projectPoint(point, zoomedCamera, size, 1.1);
      expect(after.scale).toBeCloseTo(before.scale * factor);
      expect(after.x - size.width / 2).toBeCloseTo(
        (before.x - size.width / 2) * factor,
      );
      expect(after.y - size.height / 2).toBeCloseTo(
        (before.y - size.height / 2) * factor,
      );
    }
  });

  it("uses the same nonlinear falloff for node size and spatial placement", () => {
    const inner = { x: 400, y: 0 };
    const outer = { x: 1800, y: 0 };
    const near = projectPoint(inner, camera, size, 1.1);
    const far = projectPoint(outer, camera, size, 1.1);
    const nearPlacementScale = (near.x - size.width / 2) / inner.x;
    const farPlacementScale = (far.x - size.width / 2) / outer.x;
    expect(near.scale / far.scale).toBeCloseTo(
      nearPlacementScale / farPlacementScale,
    );
    expect(far.scale).toBeLessThan(near.scale);
  });

  it("packs distant ideas inside the viewport with progressively shorter gaps and smaller circles", () => {
    const points = [200, 400, 600, 800].map((x) =>
      projectPoint({ x, y: 0 }, camera, size, 1.1),
    );
    expect(points[1].x - points[0].x).toBeGreaterThan(
      points[3].x - points[2].x,
    );
    expect(points[0].scale).toBeGreaterThan(points[3].scale);
    for (const viewport of [size, { width: 320, height: 500 }]) {
      for (const distance of [100, 1000, 1000000]) {
        const point = projectPoint(
          { x: distance, y: -distance },
          camera,
          viewport,
          1.1,
        );
        const radius = 43 * point.scale;
        expect(point.x - radius).toBeGreaterThan(0);
        expect(point.x + radius).toBeLessThan(viewport.width);
        expect(point.y - radius).toBeGreaterThan(0);
        expect(point.y + radius).toBeLessThan(viewport.height);
      }
    }
    const plain = projectPoint({ x: 160, y: 70 }, camera, size, 0);
    const almostPlain = projectPoint({ x: 160, y: 70 }, camera, size, 0.000001);
    expect(Math.abs(plain.x - almostPlain.x)).toBeLessThan(0.001);
  });

  it("pans in world space and bounds zoom without changing the selected world centre", () => {
    expect(panCamera({ x: 10, y: 20, zoom: 2 }, { x: 40, y: -20 })).toEqual({
      x: -10,
      y: 30,
      zoom: 2,
    });
    expect(zoomCamera(camera, 100).zoom).toBe(2);
    expect(zoomCamera(camera, 0.001).zoom).toBe(0.3);
    expect(zoomCamera({ x: 10, y: 20, zoom: 1 }, 1.2)).toEqual({
      x: 10,
      y: 20,
      zoom: 1.2,
    });
  });

  it("fits the undistorted overview including node radii at narrow viewport sizes", () => {
    const points = [
      { x: -600, y: -300 },
      { x: 800, y: 450 },
    ];
    const viewport = { width: 320, height: 500 };
    const fitted = fitCamera(points, viewport, 44);
    for (const point of points) {
      const projected = projectPoint(point, fitted, viewport, 0);
      const radius = 44 * projected.scale;
      expect(projected.x - radius).toBeGreaterThanOrEqual(15);
      expect(projected.x + radius).toBeLessThanOrEqual(305);
      expect(projected.y - radius).toBeGreaterThanOrEqual(15);
      expect(projected.y + radius).toBeLessThanOrEqual(485);
    }
    expect(fitCamera([], viewport, 44)).toEqual(camera);
  });
});
