import type { NodeStyleCondition } from "@lensmap/document";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import type { GraphData } from "./graph";
import {
  conditionKey,
  createStyleEnvironment,
  styleConditions,
} from "./responsive-style";

export function useNodeStyleMatches(
  graph: GraphData,
  canvas: RefObject<HTMLDivElement | null>,
  size: { width: number; height: number },
) {
  const conditions = styleConditions(graph);
  const signature = JSON.stringify(conditions);
  const environment = useRef<ReturnType<typeof createStyleEnvironment>>(null);
  const [matches, setMatches] = useState<ReadonlyMap<string, boolean>>(
    new Map(),
  );
  const refreshSize = () => {
    const element = canvas.current;
    if (!element || !environment.current) return;
    const style = getComputedStyle(element);
    environment.current.resize(
      element.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight),
      element.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom),
      element,
    );
  };
  // The serialized condition inventory is stable across graph/paint-only edits.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshSize reads this viewer's live canvas and the just-created environment.
  useLayoutEffect(() => {
    const conditions: NodeStyleCondition[] = JSON.parse(signature);
    if (!conditions.length) {
      setMatches((previous) => (previous.size ? new Map() : previous));
      return;
    }
    const current = createStyleEnvironment(conditions, setMatches);
    environment.current = current;
    refreshSize();
    return () => {
      current.dispose();
      if (environment.current === current) environment.current = null;
    };
  }, [signature]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: resize notifications trigger a fresh content-box read, not camera/lens updates.
  useLayoutEffect(refreshSize, [size.width, size.height]);
  return {
    matches,
    ready: conditions.every((condition) =>
      matches.has(conditionKey(condition)),
    ),
  };
}
