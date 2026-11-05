import { useId } from "react";
import { colours, type GraphNode } from "./graph";
import type { Point } from "./lens";
import type { Continuation } from "./neighbourhood";

export default function NeighbourhoodContinuations({
  continuations,
  positions,
  centreKey,
  nodes,
  nodeRadius,
}: {
  continuations: readonly Continuation[];
  positions: ReadonlyMap<string, Point & { scale: number }>;
  centreKey: string;
  nodes: readonly GraphNode[];
  nodeRadius: number;
}) {
  const prefix = useId();
  const origin = positions.get(centreKey);
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const segments = continuations.flatMap((continuation, index) => {
    const point = positions.get(continuation.at);
    const target = byKey.get(continuation.edge.to);
    if (!point || !origin || !target) return [];
    const incoming = continuation.edge.to === continuation.at;
    const angle =
      Math.atan2(point.y - origin.y, point.x - origin.x) + continuation.offset;
    const ux = Math.cos(angle),
      uy = Math.sin(angle);
    const radius = nodeRadius * point.scale + (incoming ? 7 : 3);
    const near = { x: point.x + ux * radius, y: point.y + uy * radius };
    const far = {
      x: near.x + ux * 70 * point.scale,
      y: near.y + uy * 70 * point.scale,
    };
    const [from, to] = incoming ? [far, near] : [near, far];
    return [
      {
        ...continuation,
        incoming,
        near,
        far,
        target,
        id: `${prefix}-${index}`,
        path: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      },
    ];
  });
  return (
    <g className="continuations">
      <defs>
        {segments.map((segment) => (
          <linearGradient
            key={segment.edge.key}
            id={segment.id}
            gradientUnits="userSpaceOnUse"
            x1={segment.near.x}
            y1={segment.near.y}
            x2={segment.far.x}
            y2={segment.far.y}
          >
            <stop
              offset="0%"
              stopColor={colours[segment.target.branch]}
              stopOpacity={0.65}
            />
            <stop
              offset="100%"
              stopColor={colours[segment.target.branch]}
              stopOpacity={0}
            />
          </linearGradient>
        ))}
      </defs>
      {segments.map((segment) => (
        <path
          key={segment.edge.key}
          data-continuation={segment.edge.key}
          data-kind={segment.edge.kind}
          data-direction={segment.incoming ? "incoming" : "outgoing"}
          d={segment.path}
          stroke={`url(#${segment.id})`}
          className={`edge continuation ${segment.edge.kind}`}
          markerEnd={
            segment.incoming && segment.edge.kind === "cross"
              ? `url(#arrow-${segment.target.branch})`
              : undefined
          }
        />
      ))}
    </g>
  );
}
