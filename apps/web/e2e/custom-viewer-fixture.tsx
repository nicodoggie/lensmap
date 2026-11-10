import React from "react";
import { createRoot } from "react-dom/client";
import { resolveConnectionWidth } from "../src/connection-style";
import type { GraphData } from "../src/graph";
import Viewer from "../src/Viewer";

let update = () => {};
export function restyle() {
  update();
}
export function mount() {
  document.body.innerHTML = '<div id="custom-root"></div>';
  const nodes = [
    {
      key: "a",
      title: "Alpha",
      markdown: "Alpha",
      unresolved: false,
      branch: "blue",
      x: -180,
      y: 0,
    },
    {
      key: "b",
      title: "Beta",
      markdown: "Beta",
      unresolved: false,
      branch: "mint",
      x: 180,
      y: 0,
    },
  ];
  nodes.push({
    key: "c",
    title: "Beyond",
    markdown: "Beyond",
    unresolved: false,
    branch: "rose",
    x: 450,
    y: 220,
  });
  const presentation = {
    strokeWidth: "calc(0.5em + 2px)",
    lineStyle: "solid",
    lineColor: "rgb(220, 40, 70)",
    startMarker: "circle",
    endMarker: "diamond",
    text: "reveals",
    reverseText: "is revealed by",
  };
  const edges = [
    {
      key: "out",
      from: "b",
      to: "c",
      kind: "cross",
      type: "reveals",
      presentation,
    },
    {
      key: "in",
      from: "c",
      to: "b",
      kind: "cross",
      type: "reveals",
      presentation,
    },
    {
      key: "shapes",
      from: "a",
      to: "b",
      kind: "branch",
      type: "reveals",
      presentation,
    },
    {
      key: "bar",
      from: "a",
      to: "b",
      kind: "cross",
      type: "blocks",
      presentation: {
        ...presentation,
        startMarker: "bar",
        endMarker: "bar",
        strokeWidth: 4,
      },
    },
    {
      key: "zero",
      from: "b",
      to: "a",
      kind: "cross",
      type: "hidden",
      presentation: { ...presentation, strokeWidth: 0 },
    },
    {
      key: "loop",
      from: "a",
      to: "a",
      kind: "cross",
      type: "reveals",
      presentation: { ...presentation, lineStyle: "dotted", strokeWidth: 3 },
    },
  ];
  const element = document.getElementById("custom-root");
  if (!element) throw Error("Missing fixture root");
  const root = createRoot(element);
  const graph = { nodes, edges } as GraphData;
  root.render(React.createElement(Viewer, { graph }));
  update = () =>
    root.render(
      React.createElement(Viewer, {
        graph: {
          ...graph,
          edges: graph.edges.map((edge) => ({
            ...edge,
            presentation: edge.presentation
              ? { ...edge.presentation, lineColor: "blue" }
              : undefined,
          })),
        },
      }),
    );
}

export function widths() {
  const root = document.getElementById("custom-root");
  if (!root) throw Error("Missing root");
  root.style.fontSize = "20px";
  return ["2.5", "2em", "1rem", "10%", "calc(2px + 1em)", "0px"].map((value) =>
    resolveConnectionWidth(value, root, 300, 400),
  );
}
