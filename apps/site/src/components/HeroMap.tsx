import { useCallback, useEffect, useRef, useState } from "react";
import {
  type GraphData,
  type GraphNode,
  Viewer,
  type ViewerState,
} from "../../../web/src/embed";
import { heroView, siteDestination } from "../hero";
import "../../../web/src/viewer.css";

export default function HeroMap({
  graph,
  base,
}: {
  graph: GraphData;
  base: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [initial, setInitial] = useState<ReturnType<typeof heroView>>();
  const [selected, setSelected] = useState(graph.nodes[0]?.key);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0)
        setInitial(
          (previous) => previous ?? heroView(graph, { width, height }),
        );
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [graph]);
  const onStateChange = useCallback(
    (state: ViewerState) => setSelected(state.selected),
    [],
  );
  const activate = (node: GraphNode) => {
    if (!node.destination) return;
    const destination = siteDestination(node.destination.url, base);
    if (destination.external)
      window.open(destination.href, "_blank", "noopener,noreferrer");
    else window.location.assign(destination.href);
  };
  const active = graph.nodes.find((node) => node.key === selected);
  const destination = active?.destination
    ? siteDestination(active.destination.url, base)
    : undefined;
  return (
    <div className="hero-interaction">
      <div className="hero-canvas" ref={container}>
        {initial && (
          <Viewer
            graph={initial.graph}
            embedded
            showInspector={false}
            initialState={initial.state}
            onStateChange={onStateChange}
            onActivatePortal={activate}
          />
        )}
      </div>
      <div className="hero-action" aria-live="polite">
        {destination ? (
          <a
            href={destination.href}
            target={destination.external ? "_blank" : undefined}
            rel={destination.external ? "noopener noreferrer" : undefined}
          >
            Open {active?.title} <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <p>Select a thought. Follow a connection.</p>
        )}
      </div>
    </div>
  );
}
