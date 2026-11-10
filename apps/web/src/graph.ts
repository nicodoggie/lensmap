import type {
  ConnectionPresentation,
  ConnectionType,
  Thought,
} from "@lensmap/document";
import type { Point } from "./lens";

export const colours = {
  blue: "#83c8ff",
  amber: "#f7c46c",
  mint: "#82dfc1",
  rose: "#e9a3ca",
};
export type Branch = keyof typeof colours;

/** Renderer identity is separate from optional author-addressable IDs. */
export interface GraphNode extends Point {
  key: string;
  id?: string;
  title: string;
  markdown: string;
  branch: Branch;
  unresolved: boolean;
  destination?: Thought["destination"];
}
export interface GraphEdge {
  key: string;
  from: string;
  to: string;
  kind: "branch" | "cross";
  type?: ConnectionType;
  presentation?: ConnectionPresentation;
}
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function label(node: GraphNode): string {
  return node.unresolved
    ? "Unresolved thought"
    : node.title.replace(/^#{1,6}\s+/, "").replace(/[*_`]/g, "");
}
