/** Run in the browser: compare real unmarked targets with rendered node outlines. */
export function unmarkedTargetGaps(scene: Element) {
  const nodes = [...scene.querySelectorAll<HTMLElement>(".node[data-node]")];
  return [...scene.querySelectorAll<SVGPathElement>("path[data-edge]")]
    .filter((path) => !path.hasAttribute("marker-end"))
    .flatMap((path) => {
      const pairs = nodes.flatMap((from) =>
        nodes
          .filter(
            (to) =>
              `${from.dataset.node}-${to.dataset.node}` ===
              path.getAttribute("data-edge"),
          )
          .map((to) => ({ from, to })),
      );
      if (pairs.length !== 1)
        throw new Error("Expected one rendered endpoint pair.");
      const pair = pairs[0];
      if (pair.from === pair.to) return [];
      const matrix = path.getScreenCTM();
      if (!matrix) throw new Error("Expected a rendered connection matrix.");
      const end = path.getPointAtLength(path.getTotalLength());
      const point = new DOMPoint(end.x, end.y).matrixTransform(matrix);
      const bounds = pair.to.getBoundingClientRect();
      return [
        {
          edge: path.getAttribute("data-edge-key"),
          type: path.getAttribute("data-type"),
          gap:
            Math.hypot(
              point.x - bounds.x - bounds.width / 2,
              point.y - bounds.y - bounds.height / 2,
            ) -
            bounds.width / 2,
        },
      ];
    });
}
