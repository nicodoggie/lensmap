import React from "react";
import { createRoot } from "react-dom/client";
import type { GraphData } from "../src/graph";
import Viewer, { type ViewerState } from "../src/Viewer";

let repaint = () => {};
export function restyle() {
  repaint();
}
export function mount(restoredNeighbourhood = false) {
  document.body.innerHTML = '<div id="styling-root"></div>';
  const element = document.getElementById("styling-root");
  if (!element) throw Error("Missing root");
  const root = createRoot(element);
  const graph: GraphData = {
    nodes: [
      {
        key: "auto",
        title:
          "**Rendered summary** with a substantial amount of readable text",
        markdown: "body",
        branch: "blue",
        unresolved: false,
        x: 0,
        y: 0,
        position: { x: 0, y: 0 },
        style: {
          scale: "auto",
          icon: "★",
          declarations: [
            { property: "font-size", value: "20px", important: false },
            { property: "padding", value: "16px", important: false },
            {
              property: "background-color",
              value: "rgb(180, 30, 40)",
              important: true,
            },
          ],
        },
      },
      {
        key: "fixed",
        title: "Fixed",
        markdown: "Fixed",
        branch: "mint",
        unresolved: false,
        x: 400,
        y: 0,
        position: { x: 400, y: 0 },
        style: { scale: 2, declarations: [] },
      },
      {
        key: "distant",
        title:
          "Another substantial rendered summary outside the first neighbourhood",
        markdown: "Distant body",
        branch: "amber",
        unresolved: false,
        x: 800,
        y: 0,
        position: { x: 800, y: 0 },
        style: {
          scale: "auto",
          declarations: [
            { property: "font-size", value: "20px", important: false },
          ],
        },
      },
    ],
    edges: [
      { key: "link", from: "auto", to: "fixed", kind: "branch" },
      { key: "loop", from: "auto", to: "auto", kind: "cross" },
      { key: "onward", from: "fixed", to: "distant", kind: "branch" },
    ],
  };
  const initialState: ViewerState | undefined = restoredNeighbourhood
    ? {
        selected: "auto",
        camera: { x: 0, y: 0, zoom: 0.85 },
        strength: 1.1,
        overview: false,
        inNeighbourhood: true,
        neighbourhoodCamera: { x: 0, y: 0, zoom: 1 },
        neighbourhoodStrength: 1.1,
        returnOverview: true,
      }
    : undefined;
  const render = () =>
    root.render(
      React.createElement(Viewer, {
        graph,
        initialOverview: true,
        initialState,
        showInspector: false,
      }),
    );
  render();
  repaint = () => {
    const style = graph.nodes[0].style;
    if (!style) throw Error("Missing presentation");
    style.declarations = style.declarations.filter(
      (d) => d.property !== "background-color",
    );
    root.render(
      <Viewer
        graph={{ ...graph, nodes: [...graph.nodes] }}
        initialOverview
        showInspector={false}
      />,
    );
  };
}
