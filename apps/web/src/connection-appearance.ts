import type { ConnectionType } from "@lensmap/document";

/** Continuations expose only their real endpoint, never the faded cut end. */
export function connectionAppearance(
  type?: ConnectionType,
  continuation?: "incoming" | "outgoing",
): { dashed: boolean; start?: "arrow"; end?: "arrow" | "bar" } {
  return {
    dashed: type === "optional",
    ...(type === "follows" && continuation !== "incoming"
      ? { start: "arrow" as const }
      : {}),
    ...(continuation !== "outgoing" &&
    (type === "precedes" || type === "prevents")
      ? { end: type === "precedes" ? ("arrow" as const) : ("bar" as const) }
      : {}),
  };
}

/** Compatibility for graphs produced before resolved presentation was added. */
export function fallbackPresentation(
  type?: ConnectionType,
): import("@lensmap/document").ConnectionPresentation {
  const appearance = connectionAppearance(type);
  return {
    strokeWidth: 2.5,
    lineStyle: appearance.dashed ? "dashed" : "solid",
    lineColor: "auto",
    startMarker: appearance.start ?? "none",
    endMarker: appearance.end ?? "none",
    text: "connected to",
    reverseText: "connected to",
  };
}
