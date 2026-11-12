import { useEffect, useRef, useState } from "react";
import type { GraphData } from "../../../web/src/embed";
import {
  createStyleEnvironment,
  resolveGraphPresentation,
  styleConditions,
} from "../../../web/src/responsive-style";
import { heroView } from "../hero";
import MapSession from "./MapSession";
import "../../../web/src/viewer.css";

export default function HeroMap({
  graph,
  base,
}: {
  graph: GraphData;
  base: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const [initial, setInitial] = useState<ReturnType<typeof heroView>>();

  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0 && !initialized.current) {
        const environment = createStyleEnvironment(styleConditions(graph));
        try {
          environment.resize(width, height, container.current ?? undefined);
          const resolved = resolveGraphPresentation(graph, environment.matches);
          const view = heroView(resolved, { width, height });
          initialized.current = true;
          setInitial({ graph, state: view.state });
        } finally {
          environment.dispose();
        }
      }
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [graph]);
  return (
    <div className={initial ? undefined : "hero-canvas"} ref={container}>
      {initial && <MapSession initial={initial} base={base} />}
    </div>
  );
}
