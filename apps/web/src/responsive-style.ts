import {
  type NodeStyleCondition,
  resolveNodePresentation,
} from "@lensmap/document";
import { layoutGraph } from "./document/layout";
import type { GraphData } from "./graph";
import { baseRadius, positionAxis } from "./node-style";

export const conditionKey = (condition: NodeStyleCondition) =>
  JSON.stringify([condition.kind, condition.query]);

export function styleConditions(graph: GraphData): NodeStyleCondition[] {
  const conditions = new Map<string, NodeStyleCondition>();
  for (const node of graph.nodes)
    for (const rule of node.style?.rules ?? [])
      for (const condition of rule.conditions ?? [])
        conditions.set(conditionKey(condition), condition);
  return [...conditions]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, c]) => c);
}

const geometryKey = (graph: GraphData) =>
  JSON.stringify({
    nodes: graph.nodes.map((node) => [
      node.key,
      positionAxis(node, "x"),
      positionAxis(node, "y"),
      node.baseRadius ?? 43,
    ]),
    edges: graph.edges.map((edge) => [edge.key, edge.from, edge.to, edge.kind]),
  });
const placementKey = (graph: GraphData) =>
  JSON.stringify(graph.nodes.map((node) => [node.key, node.x, node.y]));

export interface PreviousPresentation {
  input: GraphData;
  graph: GraphData;
}

/** Resolve authored presentation before layout; camera state never enters it. */
export function resolveGraphPresentation(
  input: GraphData,
  matches: (condition: NodeStyleCondition) => boolean,
  measured: ReadonlyMap<string, number> = new Map(),
  previous?: PreviousPresentation,
): GraphData {
  const nodes = input.nodes.map((node) => {
    const style = node.style?.rules
      ? resolveNodePresentation(node.style.rules, matches)
      : node.style;
    const radius =
      (style?.scale === "auto" ? measured.get(node.key) : undefined) ??
      baseRadius(style);
    return style === node.style && radius === (node.baseRadius ?? 43)
      ? node
      : { ...node, style, baseRadius: radius };
  });
  const next = { nodes, edges: input.edges };
  if (
    previous &&
    placementKey(previous.input) === placementKey(input) &&
    geometryKey(previous.graph) === geometryKey(next)
  ) {
    const points = new Map(
      previous.graph.nodes.map((node) => [node.key, node]),
    );
    return {
      ...next,
      nodes: nodes.map((node) => ({
        ...node,
        x: points.get(node.key)?.x ?? node.x,
        y: points.get(node.key)?.y ?? node.y,
      })),
    };
  }
  if (geometryKey(input) === geometryKey(next))
    return nodes.every((node, i) => node === input.nodes[i]) ? input : next;
  return layoutGraph(nodes, input.edges);
}

/** Native query evaluation in an isolated, explicit-size shadow container.
 * The actual map does not acquire containment or lose its intrinsic sizing.
 */
export function createStyleEnvironment(
  conditions: readonly NodeStyleCondition[],
  changed?: (matches: ReadonlyMap<string, boolean>) => void,
) {
  const media = new Map<string, MediaQueryList>();
  const flags = new Map<string, HTMLElement>();
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;container-type:size;box-sizing:content-box;padding:0;border:0;min-width:0;max-width:none;min-height:0;max-height:none;width:0;height:0;";
  const shadow = host.attachShadow({ mode: "open" });
  const sheet = new CSSStyleSheet();
  const sheetRules: string[] = [];
  for (const [index, condition] of conditions.entries()) {
    const key = conditionKey(condition);
    if (condition.kind === "media") {
      media.set(key, matchMedia(condition.query));
    } else if (condition.kind === "container") {
      const id = `query-${index}`;
      const text = `@container ${condition.query}{#${id}{--lensmap-query-match:1}}`;
      // Inspect CSSOM before adopting a generated rule. Even a manually supplied
      // presentation cannot inject selectors/declarations outside this probe.
      try {
        const check = new CSSStyleSheet();
        check.insertRule(text);
        const outer = check.cssRules[0];
        if (
          !(outer instanceof CSSContainerRule) ||
          outer.containerName ||
          outer.cssRules.length !== 1
        )
          continue;
        const rule = outer.cssRules[0];
        if (
          !(rule instanceof CSSStyleRule) ||
          rule.selectorText !== `#${id}` ||
          rule.style.length !== 1 ||
          rule.style.getPropertyValue("--lensmap-query-match") !== "1"
        )
          continue;
        const flag = document.createElement("i");
        flag.id = id;
        shadow.append(flag);
        flags.set(key, flag);
        sheetRules.push(text);
      } catch {
        // The engine diagnoses source errors; an unsupported host rule is inert.
      }
    }
  }
  sheet.replaceSync(sheetRules.join("\n"));
  shadow.adoptedStyleSheets = [sheet];
  if (flags.size) document.body.append(host);
  let previous: ReadonlyMap<string, boolean> = new Map();
  let context: Element | undefined;
  const refresh = () => {
    if (context) {
      const style = getComputedStyle(context);
      host.style.font = style.font;
      host.style.writingMode = style.writingMode;
    }
    const next = new Map<string, boolean>();
    for (const condition of conditions) {
      const key = conditionKey(condition);
      const flag = flags.get(key);
      next.set(
        key,
        media.get(key)?.matches ??
          (flag
            ? getComputedStyle(flag)
                .getPropertyValue("--lensmap-query-match")
                .trim() === "1"
            : false),
      );
    }
    if (JSON.stringify([...previous]) !== JSON.stringify([...next])) {
      previous = next;
      changed?.(next);
    }
  };
  for (const query of media.values()) query.addEventListener("change", refresh);
  window.addEventListener("resize", refresh);
  document.fonts.addEventListener("loadingdone", refresh);
  return {
    matches: (condition: NodeStyleCondition) =>
      previous.get(conditionKey(condition)) ?? false,
    resize(width: number, height: number, element?: Element) {
      context = element;
      host.style.width = `${width}px`;
      host.style.height = `${height}px`;
      refresh();
    },
    dispose() {
      for (const query of media.values())
        query.removeEventListener("change", refresh);
      window.removeEventListener("resize", refresh);
      document.fonts.removeEventListener("loadingdone", refresh);
      host.remove();
    },
  };
}
