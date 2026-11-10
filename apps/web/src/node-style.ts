import type { Thought } from "@lensmap/document";

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
