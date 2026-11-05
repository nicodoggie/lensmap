import { describe, expect, it } from "vitest";
import { limitMagnification } from "./clearance";
import { projectPoint } from "./lens";

const radius = 43;
const size = { width: 1000, height: 800 };
const camera = { x: 0, y: 0, zoom: 1 };
const points = [
  Object.freeze({ key: "near", x: 300, y: 0 }),
  Object.freeze({ key: "far", x: 412, y: 0 }),
];

function projected(x = 0) {
  return points.map((point) => ({
    ...projectPoint(point, { ...camera, x }, size, 1.1),
    key: point.key,
  }));
}

const crowded = [
  Object.freeze({ key: "a", x: 0, y: 0, scale: 1.8 }),
  Object.freeze({ key: "b", x: 84, y: 0, scale: 1.1 }),
  Object.freeze({ key: "c", x: 62, y: 34, scale: 0.8 }),
];

describe("clearance-aware magnification", () => {
  it("separates projected circles without moving centres and lets the peripheral circle yield first", () => {
    const original = projected().map((point) => Object.freeze(point));
    const distance = Math.hypot(
      original[1].x - original[0].x,
      original[1].y - original[0].y,
    );
    expect(radius * (original[0].scale + original[1].scale)).toBeGreaterThan(
      distance,
    );
    const limited = limitMagnification(original, radius, 1.1);
    expect(radius * (limited[0].scale + limited[1].scale)).toBeLessThanOrEqual(
      distance - 6 + 1e-7,
    );
    expect(limited[0].scale / original[0].scale).toBeGreaterThan(
      limited[1].scale / original[1].scale,
    );
    for (const [index, point] of limited.entries()) {
      expect({ x: point.x, y: point.y, key: point.key }).toEqual({
        x: original[index].x,
        y: original[index].y,
        key: original[index].key,
      });
      expect(point.scale).toBeLessThanOrEqual(original[index].scale);
      expect(point.scale).toBeGreaterThan(0);
    }
    expect(points[0]).toEqual({ key: "near", x: 300, y: 0 });
  });

  it("satisfies competing pair clearances independently of source order", () => {
    const limited = limitMagnification(crowded, radius, 1);
    for (let i = 0; i < limited.length; i++) {
      for (let j = i + 1; j < limited.length; j++) {
        const distance = Math.hypot(
          limited[i].x - limited[j].x,
          limited[i].y - limited[j].y,
        );
        expect(
          radius * (limited[i].scale + limited[j].scale),
        ).toBeLessThanOrEqual(distance - 6 + 1e-7);
      }
    }
    const reversed = limitMagnification([...crowded].reverse(), radius, 1);
    for (const point of limited)
      expect(
        reversed.find((entry) => entry.key === point.key)?.scale,
      ).toBeCloseTo(point.scale, 10);
  });

  it("blends continuously from zero strength and changes continuously under a small pan", () => {
    expect(limitMagnification(crowded, radius, 0)).toEqual(crowded);
    const full = limitMagnification(crowded, radius, 1);
    const half = limitMagnification(crowded, radius, 0.5);
    half.forEach((point, index) => {
      expect(point.scale).toBeCloseTo(
        (crowded[index].scale + full[index].scale) / 2,
      );
    });
    const initial = limitMagnification(projected(), radius, 1.1);
    const panned = limitMagnification(projected(0.0001), radius, 1.1);
    panned.forEach((point, index) => {
      expect(Math.abs(point.scale - initial[index].scale)).toBeLessThan(0.001);
    });
  });

  it("leaves isolated circles unchanged and keeps coincident context dots finite without enlargement", () => {
    expect(limitMagnification([], radius, 1)).toEqual([]);
    expect(limitMagnification([crowded[0]], radius, 1)).toEqual([crowded[0]]);
    const coincident = [
      { x: 0, y: 0, scale: 1 },
      { x: 0, y: 0, scale: 1 },
      { x: 0, y: 0, scale: 0.000001 },
    ];
    limitMagnification(coincident, radius, 1).forEach((point, index) => {
      expect(Number.isFinite(point.scale)).toBe(true);
      expect(point.scale).toBeGreaterThan(0);
      expect(point.scale).toBeLessThanOrEqual(coincident[index].scale);
      expect(point.x).toBe(0);
      expect(point.y).toBe(0);
    });
  });
});
