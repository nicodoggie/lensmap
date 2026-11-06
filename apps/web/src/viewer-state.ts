import type { GraphData } from "./graph";
import type { Camera } from "./lens";

/** Reconcile external graph identity independently of transient UI interactions. */
export function reconcileViewer(
  previous: GraphData,
  next: GraphData,
  selected: string,
  camera: Camera,
  mode: "replace" | "live",
) {
  if (mode === "live")
    return {
      selected:
        next.nodes.find((node) => node.key === selected)?.key ??
        next.nodes[0]?.key ??
        "",
      camera,
      reset: false,
    };
  const id = previous.nodes.find((node) => node.key === selected)?.id;
  const active =
    (id ? next.nodes.find((node) => node.id === id) : undefined) ??
    next.nodes[0];
  return {
    selected: active?.key ?? "",
    camera: { x: active?.x ?? 0, y: active?.y ?? 0, zoom: 0.85 },
    reset: true,
  };
}
