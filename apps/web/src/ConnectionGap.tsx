import type { ConnectionPresentation } from "@lensmap/document";
import { useId } from "react";
import type { Point } from "./lens";

type Marker = ConnectionPresentation["startMarker"];
function Shape({
  kind,
  colour,
  cut = false,
}: {
  kind: Marker;
  colour: string;
  cut?: boolean;
}) {
  if (kind === "circle")
    return (
      <circle
        cx="-3"
        cy="0"
        r={cut ? 2.5 : 3}
        fill={cut ? "black" : "none"}
        stroke={cut ? "black" : colour}
        strokeWidth={cut ? 0 : 1}
      />
    );
  if (kind === "diamond")
    return (
      <path
        d={
          cut
            ? "M -0.7 0 L -3 -2.3 L -5.3 0 L -3 2.3 Z"
            : "M 0 0 L -3 -3 L -6 0 L -3 3 Z"
        }
        fill={cut ? "black" : "none"}
        stroke={cut ? "black" : colour}
        strokeWidth={cut ? 0 : 1}
      />
    );
  if (kind === "bar")
    return cut ? (
      <rect x="-4.5" y="-5" width="3" height="10" fill="black" />
    ) : (
      <g stroke={colour} strokeWidth="1">
        <line x1="-5" x2="-5" y1="-3" y2="3" />
        <line x1="-1" x2="-1" y1="-3" y2="3" />
      </g>
    );
  if (kind === "arrow" && !cut)
    return (
      <path
        d="M -5 -3 L 0 0 L -5 3"
        fill="none"
        stroke={colour}
        strokeWidth="1"
      />
    );
  return null;
}

/** Masks affect only stem and halo; outlines remain transparent over any background. */
export default function StyledConnection({
  path,
  points,
  presentation,
  width,
  colour,
  className,
  attributes,
  continuation,
}: {
  path: string;
  points: readonly Point[];
  presentation: ConnectionPresentation;
  width: number;
  colour: string;
  className: string;
  attributes: Record<string, string | undefined>;
  continuation?: "incoming" | "outgoing";
}) {
  const id = useId();
  const start = continuation === "incoming" ? "none" : presentation.startMarker;
  const end = continuation === "outgoing" ? "none" : presentation.endMarker;
  const paint =
    presentation.lineColor === "auto" ? colour : presentation.lineColor;
  const marker = (kind: Marker, side: string, cut = false) => (
    <marker
      key={side}
      id={`${id}-${kind}-${side}`}
      markerUnits="strokeWidth"
      markerWidth={14}
      markerHeight={14}
      viewBox="-7 -7 14 14"
      refX="0"
      refY="0"
      orient="auto-start-reverse"
      overflow="visible"
    >
      <Shape kind={kind} colour={paint} cut={cut} />
    </marker>
  );
  const pad = Math.max(64, width * 16);
  const x = Math.min(...points.map((p) => p.x)) - pad;
  const y = Math.min(...points.map((p) => p.y)) - pad;
  const w = Math.max(...points.map((p) => p.x)) - x + pad;
  const h = Math.max(...points.map((p) => p.y)) - y + pad;
  const style = { strokeWidth: width, color: paint };
  return (
    <g
      data-presentation-width={width}
      mask={continuation ? `url(#${id}-fade)` : undefined}
    >
      <defs>
        {continuation && (
          <>
            <linearGradient
              id={`${id}-gradient`}
              gradientUnits="userSpaceOnUse"
              x1={points[0].x}
              y1={points[0].y}
              x2={points[1].x}
              y2={points[1].y}
            >
              <stop offset="0%" stopColor="white" stopOpacity={0.65} />
              <stop offset="100%" stopColor="white" stopOpacity={0} />
            </linearGradient>
            <mask
              id={`${id}-fade`}
              maskUnits="userSpaceOnUse"
              x={x}
              y={y}
              width={w}
              height={h}
              style={{ maskType: "luminance" }}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={`url(#${id}-gradient)`}
              />
            </mask>
          </>
        )}

        {marker(start, "start")}
        {marker(end, "end")}
        {marker(start, "start-cut", true)}
        {marker(end, "end-cut", true)}
        <mask
          id={`${id}-mask`}
          maskUnits="userSpaceOnUse"
          x={x}
          y={y}
          width={w}
          height={h}
          style={{ maskType: "luminance" }}
        >
          <rect x={x} y={y} width={w} height={h} fill="white" />
          <path
            d={path}
            fill="none"
            stroke="none"
            strokeWidth={width}
            markerStart={`url(#${id}-${start}-start-cut)`}
            markerEnd={`url(#${id}-${end}-end-cut)`}
          />
        </mask>
      </defs>
      <g
        visibility={width === 0 ? "hidden" : undefined}
        mask={`url(#${id}-mask)`}
      >
        <path
          d={path}
          className="edge-halo"
          style={{ strokeWidth: width * 3.2 }}
        />
        <path
          {...attributes}
          d={path}
          className={className}
          stroke={paint}
          style={style}
          markerStart={
            start === "none" ? undefined : `url(#${id}-${start}-start)`
          }
          markerEnd={end === "none" ? undefined : `url(#${id}-${end}-end)`}
          strokeLinecap={
            presentation.lineStyle === "dotted" ? "round" : undefined
          }
          strokeDasharray={
            presentation.lineStyle === "dotted"
              ? `0 ${width * 2.5}`
              : presentation.lineStyle === "dashed"
                ? `${width * 2.8} ${width * 2.4}`
                : undefined
          }
        />
      </g>
    </g>
  );
}
