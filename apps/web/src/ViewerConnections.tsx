import { connectionWording } from "@lensmap/document";
import { type GraphNode, label } from "./graph";
import type { ViewerSidebarContext } from "./Viewer";

export interface ViewerConnectionsProps
  extends Pick<ViewerSidebarContext, "graph" | "active" | "onFocus"> {
  getLabel?: (node: GraphNode) => string;
}

export default function ViewerConnections({
  graph,
  active,
  onFocus,
  getLabel = label,
}: ViewerConnectionsProps) {
  return (
    <nav className="viewer-connections" aria-label="Connected thoughts">
      {(["outgoing", "incoming"] as const).map((direction) => {
        const connections = graph.edges.filter((edge) =>
          direction === "outgoing"
            ? edge.from === active?.key
            : edge.to === active?.key,
        );
        return (
          <details className="sidebar-section outgoing" open key={direction}>
            <summary>
              {direction === "outgoing"
                ? "Outgoing connections"
                : "Incoming connections"}
            </summary>
            {connections.map((edge) => {
              const key = direction === "outgoing" ? edge.to : edge.from;
              const node = graph.nodes.find(
                (candidate) => candidate.key === key,
              );
              return (
                node && (
                  <button
                    type="button"
                    key={edge.key}
                    data-focus-key={key}
                    onClick={() => onFocus(key)}
                  >
                    {connectionWording(edge.type, direction, edge.presentation)}{" "}
                    · {getLabel(node)}
                  </button>
                )
              );
            })}
            {!connections.length && <p>No {direction} connections.</p>}
          </details>
        );
      })}
    </nav>
  );
}
