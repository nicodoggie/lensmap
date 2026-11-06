import { connectionWording } from "@lensmap/document";
import { useId } from "react";
import { connectionAppearance } from "./connection-appearance";
import { colours, type GraphNode, label } from "./graph";
import type { Point } from "./lens";
import type { Continuation } from "./neighbourhood";

export default function NeighbourhoodContinuations({
  continuations,
  positions,
  centreKey,
  nodes,
  nodeRadius,
  previewEdges,
  markerPrefix,
}: {
  markerPrefix: string;
  continuations: readonly Continuation[];
  positions: ReadonlyMap<string, Point & { scale: number }>;
  centreKey: string;
  nodes: readonly GraphNode[];
  nodeRadius: number;
  previewEdges: ReadonlySet<string>;
}) {
  const prefix = useId();
  const origin = positions.get(centreKey);
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const segments = continuations.flatMap((continuation, index) => {
    const point = positions.get(continuation.at);
    const source = byKey.get(continuation.edge.from);
    const target = byKey.get(continuation.edge.to);
    if (!point || !origin || !source || !target) return [];
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
        description: `${label(source)} ${connectionWording(continuation.edge.type, "outgoing")} ${label(target)}`,
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
        <g key={segment.edge.key}>
          <path
            data-continuation={segment.edge.key}
            data-connection-preview={
              previewEdges.has(segment.edge.key) ? "true" : undefined
            }
            data-kind={segment.edge.kind}
            data-type={segment.edge.type ?? "connected"}
            strokeDasharray={
              connectionAppearance(segment.edge.type).dashed ? "7 6" : undefined
            }
            data-direction={segment.incoming ? "incoming" : "outgoing"}
            d={segment.path}
            stroke={`url(#${segment.id})`}
            style={{ color: colours[segment.target.branch] }}
            className={`edge continuation ${segment.edge.kind} ${previewEdges.has(segment.edge.key) ? "connection-preview" : ""}`}
            markerStart={
              connectionAppearance(
                segment.edge.type,
                segment.incoming ? "incoming" : "outgoing",
              ).start
                ? `url(#${markerPrefix}-arrow-${segment.target.branch})`
                : undefined
            }
            markerEnd={
              connectionAppearance(
                segment.edge.type,
                segment.incoming ? "incoming" : "outgoing",
              ).end
                ? `url(#${markerPrefix}-${connectionAppearance(segment.edge.type).end}-${segment.target.branch})`
                : undefined
            }
          />
          <path
            className="edge-hit"
            data-continuation-hit={segment.edge.key}
            d={segment.path}
          >
            <title>{segment.description}</title>
          </path>
        </g>
      ))}
    </g>
  );
}
