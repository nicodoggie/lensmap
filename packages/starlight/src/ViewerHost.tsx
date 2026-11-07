import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  type GraphData,
  type GraphNode,
  Viewer,
  ViewerConnections,
  type ViewerSidebarContext,
} from "../../../apps/web/src/embed";

export type { GraphData, GraphNode } from "../../../apps/web/src/embed";

import "../../../apps/web/src/viewer.css";
import "./viewer-theme.css";
import SelectedThought from "./SelectedThought";
export interface Props {
  graph: GraphData;
  rendered: Record<string, string>;
  inspectorId?: string;
  /** Optional host-rendered connection label; the shared renderer owns direction/wording. */
  getLabel?: (node: GraphNode) => string;
}
function readableLabel(node: GraphNode, rendered: Props["rendered"]) {
  const template = document.createElement("template");
  template.innerHTML = rendered[node.key] ?? "";
  return (
    template.content.querySelector("h1, h2, h3, h4, h5, h6")?.textContent ??
    node.title
  );
}
function Inspector({
  context,
  rendered,
  getLabel,
}: {
  context: ViewerSidebarContext;
  rendered: Props["rendered"];
  getLabel?: Props["getLabel"];
}) {
  const { active, graph, onFocus, onFragment } = context;
  return (
    <section
      data-live-inspector
      data-selected-key={active?.key}
      aria-label="Live thought inspector"
    >
      <h2>Selected thought</h2>
      {active && (
        // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: Delegate native anchor activation, including keyboard-generated clicks; this container is not a control.
        <div
          onClick={(event) => {
            const link = (event.target as Element).closest("a");
            const href = link?.getAttribute("href");
            if (href?.startsWith("#")) {
              event.preventDefault();
              try {
                onFragment(decodeURIComponent(href.slice(1)));
              } catch {
                /* Invalid fragment stays inert. */
              }
            }
          }}
        >
          <SelectedThought key={active.key} html={rendered[active.key] ?? ""} />
        </div>
      )}
      <ViewerConnections
        graph={graph}
        active={active}
        onFocus={onFocus}
        getLabel={getLabel ?? ((node) => readableLabel(node, rendered))}
      />
    </section>
  );
}
export default function ViewerHost({
  graph,
  rendered,
  inspectorId = "default",
  getLabel,
}: Props) {
  const [targets, setTargets] = useState<HTMLElement[]>([]);
  useEffect(() => {
    setTargets(
      [
        ...document.querySelectorAll<HTMLElement>(
          "[data-lensmap-inspector-target]",
        ),
      ].filter(
        (target) => target.dataset.lensmapInspectorTarget === inspectorId,
      ),
    );
  }, [inspectorId]);
  return (
    <Viewer
      graph={graph}
      embedded
      showInspector={false}
      renderExternalInspector={(context) =>
        targets.map((target, index) =>
          createPortal(
            <Inspector
              context={context}
              rendered={rendered}
              getLabel={getLabel}
            />,
            target,
            String(index),
          ),
        )
      }
    />
  );
}
