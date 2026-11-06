import { type ReactNode, useId } from "react";
import type { Point } from "./lens";

/** Share the marker coordinate system with the cutout behind its two bars. */
export function BlockingMarker({
  id,
  colour,
  gap = false,
}: {
  id: string;
  colour: string;
  gap?: boolean;
}) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="7"
      refY="5"
      markerWidth="8"
      markerHeight="8"
      orient="auto"
      overflow={gap ? "visible" : undefined}
    >
      {gap ? (
        <rect x="3" y="-2" width="3" height="14" fill="black" />
      ) : (
        <>
          <line x1="2" x2="2" y1="0" y2="10" stroke={colour} strokeWidth="2" />
          <line x1="7" x2="7" y1="0" y2="10" stroke={colour} strokeWidth="2" />
        </>
      )}
    </marker>
  );
}

/** Cut the painted stem/halo, not the independently rendered hover path. */
export default function ConnectionGap({
  path,
  points,
  className,
  markerId,
  children,
}: {
  path: string;
  points: readonly Point[];
  className: string;
  markerId: string;
  children: ReactNode;
}) {
  const id = useId();
  // The control-point hull contains the curve even beyond the SVG viewport.
  // Leave room for the marker and strongest current preview glow as well.
  const padding = 64;
  const x = Math.min(...points.map((point) => point.x)) - padding;
  const y = Math.min(...points.map((point) => point.y)) - padding;
  const width = Math.max(...points.map((point) => point.x)) + padding - x;
  const height = Math.max(...points.map((point) => point.y)) + padding - y;
  return (
    <>
      <defs>
        <mask
          id={id}
          maskUnits="userSpaceOnUse"
          x={x}
          y={y}
          width={width}
          height={height}
          style={{ maskType: "luminance" }}
        >
          <rect x={x} y={y} width={width} height={height} fill="white" />
          <path
            d={path}
            className={className}
            style={{ stroke: "none", opacity: 1, filter: "none" }}
            markerEnd={`url(#${markerId})`}
          />
        </mask>
      </defs>
      <g mask={`url(#${id})`}>{children}</g>
    </>
  );
}
