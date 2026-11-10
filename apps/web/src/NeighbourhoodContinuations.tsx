import { connectionWording } from "@lensmap/document";
import StyledConnection from "./ConnectionGap";
import { fallbackPresentation } from "./connection-appearance";
import { markerClearance } from "./connection-style";
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
  widths,
}: {
  widths: ReadonlyMap<string, number>;
  continuations: readonly Continuation[];
  positions: ReadonlyMap<string, Point & { scale: number }>;
  centreKey: string;
  nodes: readonly GraphNode[];
  nodeRadius: number;
  previewEdges: ReadonlySet<string>;
}) {
  const origin = positions.get(centreKey);
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const segments = continuations.flatMap((continuation) => {
    const point = positions.get(continuation.at);
    const source = byKey.get(continuation.edge.from);
    const target = byKey.get(continuation.edge.to);
    if (!point || !origin || !source || !target) return [];
    const incoming = continuation.edge.to === continuation.at;
    const angle =
      Math.atan2(point.y - origin.y, point.x - origin.x) + continuation.offset;
    const ux = Math.cos(angle),
      uy = Math.sin(angle);
    const width = widths.get(continuation.edge.key) ?? 2.5;
    const presentation =
      continuation.edge.presentation ??
      fallbackPresentation(continuation.edge.type);
    const clearance = markerClearance(
      incoming ? presentation.endMarker : presentation.startMarker,
      width,
    );
    const radius =
      (byKey.get(continuation.at)?.baseRadius ?? nodeRadius) * point.scale +
      clearance;
    const near = { x: point.x + ux * radius, y: point.y + uy * radius };
    const far = {
      x: near.x + ux * 70 * point.scale,
      y: near.y + uy * 70 * point.scale,
    };
    const [from, to] = incoming ? [far, near] : [near, far];
    return [
      {
        ...continuation,
        presentation,
        incoming,
        near,
        far,
        target,
        description: `${label(source)} ${connectionWording(continuation.edge.type, "outgoing", continuation.edge.presentation)} ${label(target)}`,
        path: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      },
    ];
  });
  return (
    <g className="continuations">
      {segments.map((segment) => {
        const edgeClass = `edge continuation ${segment.edge.kind} ${previewEdges.has(segment.edge.key) ? "connection-preview" : ""}`;
        return (
          <g key={segment.edge.key}>
            <StyledConnection
              path={segment.path}
              points={[segment.near, segment.far]}
              presentation={segment.presentation}
              width={widths.get(segment.edge.key) ?? 2.5}
              colour={colours[segment.target.branch]}
              className={edgeClass}
              continuation={segment.incoming ? "incoming" : "outgoing"}
              attributes={{
                "data-continuation": segment.edge.key,
                "data-connection-preview": previewEdges.has(segment.edge.key)
                  ? "true"
                  : undefined,
                "data-kind": segment.edge.kind,
                "data-type": segment.edge.type ?? "connected",
                "data-direction": segment.incoming ? "incoming" : "outgoing",
              }}
            />
            <path
              className="edge-hit"
              data-continuation-hit={segment.edge.key}
              d={segment.path}
            >
              <title>{segment.description}</title>
            </path>
          </g>
        );
      })}
    </g>
  );
}
