import { DocumentSession } from "@lensmap/document";
import React from "react";
import { createRoot } from "react-dom/client";
import type { GraphData } from "../src/graph";
import { layoutSemanticGraph } from "../src/semantic-layout";
import Viewer, { type ViewerState } from "../src/Viewer";

let repaint = () => {};
export function restyle() {
  repaint();
}

let responsiveState: ViewerState | undefined;
let responsiveSource = "";
export function getResponsiveState() {
  return responsiveState;
}
export function getResponsiveSource() {
  return responsiveSource;
}
export function setResponsiveWidth(width: number) {
  const root = document.getElementById("responsive-root");
  if (root) root.style.width = `${width}px`;
}
export function mountResponsive(targeted = false, fluidTypography = false) {
  document.body.innerHTML =
    '<div id="responsive-root" style="max-width:100%;margin:auto"></div>';
  const element = document.getElementById("responsive-root");
  if (!element) throw Error("Missing responsive root");
  element.style.width = targeted ? "390px" : "900px";
  responsiveSource = `version: v1
node_styles:
  "*": {color: "#b5e6d2"}
nodes:
  - id: root
    summary: Root
    position: {x: 0, y: 0}
    connections:
      - id: adaptive
        summary: A responsive thought with readable text
        style: |
          --lensmap-x: 320;
          --lensmap-y: 0;
          --lensmap-scale: auto;
          font-size: 18px;
          padding: 8px;
          border: 2px solid blue;
          background-color: white;
          color: black;
          @container (max-width: 700px) {
            --lensmap-x: 0;
            --lensmap-y: 260;
            font-size: 24px;
            padding: 12px;
          }
          @media (width < 700px) { border-color: red; }
          @media (prefers-color-scheme: dark) { background-color: orange; }
`;
  if (fluidTypography) {
    responsiveSource = responsiveSource.replace(
      "A responsive thought with readable text",
      "Fluid viewport text",
    );
    responsiveSource +=
      "          @media (width > 700px) { font-size: 4vw; }\n";
  }
  const session = new DocumentSession(
    "fixture:responsive.lensmap",
    responsiveSource,
  );
  const snapshot = session.snapshot();
  if (!snapshot.valid || !snapshot.graph)
    throw Error(JSON.stringify(snapshot.diagnostics));
  const graph = layoutSemanticGraph(snapshot.graph);
  const root = createRoot(element);
  root.render(
    <Viewer
      graph={graph}
      showInspector={false}
      initialTarget={targeted ? graph.nodes[1].key : undefined}
      initialState={
        targeted
          ? undefined
          : {
              selected: graph.nodes[0].key,
              camera: { x: 0, y: 0, zoom: 0.55 },
              strength: 0,
              overview: false,
              inNeighbourhood: false,
              neighbourhoodCamera: { x: 0, y: 0, zoom: 1 },
              neighbourhoodStrength: 0,
              returnOverview: false,
            }
      }
      onStateChange={(state) => {
        responsiveState = state;
      }}
    />,
  );
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
