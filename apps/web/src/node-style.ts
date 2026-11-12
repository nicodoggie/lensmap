import type { Thought } from "@lensmap/document";
import type { GraphNode } from "./graph";

/** An explicit CSS auto releases a legacy pin; omission retains its fallback. */
export function positionAxis(
  node: Pick<GraphNode, "position" | "style">,
  axis: "x" | "y",
): number | undefined {
  const value = node.style?.[axis];
  return value === "auto" ? undefined : (value ?? node.position?.[axis]);
}

export function baseRadius(style?: Thought["style"]): number {
  return 43 * (typeof style?.scale === "number" ? style.scale : 1);
}

// Defence in depth: declarations never control viewer positioning or cues.
const properties =
  /^(color|background-color|font-family|font-size|font-weight|font-style|line-height|border(?:-(?:color|width|style|top|right|bottom|left)(?:-(?:color|width|style))?)?|padding(?:-(?:top|right|bottom|left))?)$/;
const applied = new WeakMap<HTMLElement, string[]>();
export function applyNodeStyle(
  element: HTMLElement,
  style?: Thought["style"],
  borderColour?: string,
) {
  for (const property of applied.get(element) ?? [])
    element.style.removeProperty(property);
  if (borderColour) element.style.borderColor = borderColour;
  applied.set(
    element,
    (style?.declarations ?? [])
      .map((d) => d.property)
      .filter((p) => properties.test(p)),
  );
  for (const declaration of style?.declarations ?? []) {
    if (properties.test(declaration.property))
      element.style.setProperty(
        declaration.property,
        declaration.value,
        declaration.important ? "important" : "",
      );
  }
}
