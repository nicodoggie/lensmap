import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GraphData } from "./graph";
import Viewer, { type ViewerSidebarContext } from "./Viewer";

const graph: GraphData = {
  nodes: [
    {
      key: "root",
      title: "A thought",
      markdown: "A thought",
      unresolved: false,
      branch: "blue",
      x: 0,
      y: 0,
    },
  ],
  edges: [],
};

describe("embedded viewer", () => {
  it("exposes its live inspector context without a nested main or internal rail", () => {
    let context: ViewerSidebarContext | undefined;
    const html = renderToStaticMarkup(
      createElement(Viewer, {
        graph,
        embedded: true,
        showInspector: false,
        renderExternalInspector: (current: ViewerSidebarContext) => {
          context = current;
          return createElement(
            "aside",
            { "aria-label": "External map inspector" },
            current.active?.title,
          );
        },
      }),
    );

    expect(html).not.toContain("<main");
    expect(html).not.toContain("spatial lens lab");
    expect(html).not.toContain("sidebar-resizer");
    expect(html).toContain('class="lensmap-viewer lensmap-embedded"');
    expect(html).toContain('class="workspace canvas-only"');
    expect(html).toContain('aria-label="External map inspector">A thought');
    expect(context?.graph).toBe(graph);
    expect(context?.active?.key).toBe("root");
    expect(context?.onFocus).toBeTypeOf("function");
    expect(context?.onFragment).toBeTypeOf("function");
  });
});
