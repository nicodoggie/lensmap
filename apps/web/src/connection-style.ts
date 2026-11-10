import type { ConnectionPresentation } from "@lensmap/document";

/** Outward painted extent of the marker at its route anchor, including joins. */
export function markerClearance(
  marker: ConnectionPresentation["startMarker"],
  width: number,
): number {
  if (marker === "arrow") return (width * Math.hypot(5, 3)) / 6;
  if (marker === "diamond") return width / Math.SQRT2;
  return marker === "circle" ? width / 2 : 0;
}

/** Native layout resolves CSS math and relative lengths before scene zoom. */
export function resolveConnectionWidth(
  value: number | string,
  root: HTMLElement,
  width: number,
  height: number,
): number {
  if (typeof value === "number") return value;
  const container = document.createElement("div");
  container.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;height:0;overflow:hidden";
  container.style.width = `${Math.hypot(width, height) / Math.SQRT2}px`;
  const probe = document.createElement("div");
  probe.style.width = CSS.supports("width", value)
    ? value
    : `calc((${value}) * 1px)`;
  probe.style.height = "0";
  container.append(probe);
  root.append(container);
  const result = Number.parseFloat(getComputedStyle(probe).width);
  container.remove();
  return Number.isFinite(result) ? Math.max(0, result) : 0;
}
