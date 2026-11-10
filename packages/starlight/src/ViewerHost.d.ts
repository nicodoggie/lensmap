import type { Connection, Thought } from "@lensmap/document";
import type { ReactElement } from "react";
/** Public data shape of the bundled shared viewer. Layout remains viewer-owned. */
export type GraphNode = Pick<
  Thought,
  "key" | "id" | "title" | "markdown" | "unresolved" | "destination"
> & {
  x: number;
  y: number;
  branch: "blue" | "amber" | "mint" | "rose";
};
export interface GraphData {
  nodes: GraphNode[];
  edges: Pick<
    Connection,
    "key" | "from" | "to" | "kind" | "type" | "presentation"
  >[];
}
export interface ViewerHostProps {
  graph: GraphData;
  rendered: Record<string, string>;
  inspectorId?: string;
  mapId?: string;
  getLabel?: (node: GraphNode) => string;
}
export default function ViewerHost(props: ViewerHostProps): ReactElement;
