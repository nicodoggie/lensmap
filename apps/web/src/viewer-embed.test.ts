import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ViewerConnections } from "./embed";
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
  it("shares directional connection sections with host-rendered thought labels", () => {
    const connected: GraphData = {
      nodes: [
        ...graph.nodes,
        { ...graph.nodes[0], key: "before", title: "Before" },
        { ...graph.nodes[0], key: "after", title: "After" },
      ],
      edges: [
        {
          key: "in",
          from: "before",
          to: "root",
          kind: "cross",
          type: "precedes",
        },
        {
          key: "out",
          from: "root",
          to: "after",
          kind: "cross",
          type: "prevents",
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(ViewerConnections, {
        graph: connected,
        active: connected.nodes[0],
        onFocus: () => {},
        getLabel: (node) => `Site: ${node.title}`,
      }),
    );

    expect(html).toContain("Outgoing connections");
    expect(html).toContain("Incoming connections");
    expect(html).toContain("prevents · Site: After");
    expect(html).toContain("follows · Site: Before");
    expect(html).toContain('data-focus-key="after"');
    expect(html).toContain('data-focus-key="before"');
  });

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
