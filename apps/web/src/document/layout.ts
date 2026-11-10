import {
  forceCollide,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";
import type { GraphData, GraphEdge, GraphNode } from "../graph";
import type { Point } from "../lens";
import { planSubtree, type SubtreePlan } from "./subtree";

export type NodeDraft = Omit<GraphNode, "x" | "y"> & { position?: Point };

interface LayoutNode extends SimulationNodeDatum {
  key: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

/** Run once on Apply, never on camera movement. Explicit positions remain exact. */
export function layoutGraph(nodes: NodeDraft[], edges: GraphEdge[]): GraphData {
  if (nodes.length === 0) return { nodes: [], edges };
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const children = new Map(nodes.map((node) => [node.key, [] as NodeDraft[]]));
  const childKeys = new Set<string>();
  for (const edge of edges) {
    // References may converge or cycle; only authored nesting owns hierarchy.
    if (edge.kind !== "branch") continue;
    const child = byKey.get(edge.to);
    if (child) children.get(edge.from)?.push(child);
    childKeys.add(edge.to);
  }
  const roots = nodes.filter((node) => !childKeys.has(node.key));
  const placed = new Map<string, LayoutNode>();
  const maximum = Math.max(43, ...nodes.map((n) => n.baseRadius ?? 43));
  const step = Math.max(180, maximum * 2 + 24);
  const padding = Math.max(56, maximum + 13);

  function plan(node: NodeDraft, isRoot: boolean): SubtreePlan {
    const descendants = (children.get(node.key) ?? []).map((child) =>
      plan(child, false),
    );
    return planSubtree(node.key, descendants, isRoot, step, padding);
  }
  const plans = roots.map((root) => plan(root, true));

  function seed(
    node: NodeDraft,
    subtree: SubtreePlan,
    point: Point,
    heading: number,
    isRoot: boolean,
  ): void {
    const actual = node.position ?? point;
    const fixed = Boolean(node.position) || isRoot;
    placed.set(node.key, {
      key: node.key,
      x: actual.x,
      y: actual.y,
      targetX: actual.x,
      targetY: actual.y,
      fx: fixed ? actual.x : undefined,
      fy: fixed ? actual.y : undefined,
    });
    subtree.children.forEach((placement) => {
      const child = byKey.get(placement.subtree.key);
      if (!child)
        throw new Error(
          `Automatic layout could not find child "${placement.subtree.key}".`,
        );
      const angle = heading + placement.angle;
      const target = {
        x: actual.x + Math.cos(angle) * placement.distance,
        y: actual.y + Math.sin(angle) * placement.distance,
      };
      const childPoint = child.position ?? target;
      const direction =
        childPoint.x === actual.x && childPoint.y === actual.y
          ? angle
          : Math.atan2(childPoint.y - actual.y, childPoint.x - actual.x);
      // Authored pins remain absolute constraints. Their automatic descendants
      // rebase at the actual pin rather than moving the pin with an ideal contour.
      seed(child, placement.subtree, target, direction, false);
    });
  }

  // Multiple top-level ideas stay separate even if reference edges join them.
  const anchor = nodes[0].position ?? { x: 0, y: 0 };
  const rootRadius =
    roots.length > 1 ? (step * 2) / Math.sin(Math.PI / roots.length) : 0;
  roots.forEach((root, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / roots.length;
    seed(
      root,
      plans[index],
      {
        x: anchor.x + Math.cos(angle) * rootRadius,
        y: anchor.y + rootRadius + Math.sin(angle) * rootRadius,
      },
      0,
      true,
    );
  });

  // D3's fixed-seed collision solver relaxes only initial layout targets. No link
  // force: cross-links cannot pull a child into a different branch or component.
  const simulation = forceSimulation([...placed.values()])
    .stop()
    .force("x", forceX<LayoutNode>((node) => node.targetX).strength(0.2))
    .force("y", forceY<LayoutNode>((node) => node.targetY).strength(0.2))
    .force("collide", forceCollide<LayoutNode>(padding).iterations(2));
  const ticks = Math.ceil(
    Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()),
  );
  simulation.tick(ticks);

  return {
    nodes: nodes.map(({ position, ...node }) => {
      const point = placed.get(node.key);
      if (!point)
        throw new Error(`Automatic layout could not place node "${node.key}".`);
      return {
        ...node,
        ...(position ? { position } : {}),
        x: point.x,
        y: point.y,
      };
    }),
    edges,
  };
}
