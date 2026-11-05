import { type CSSProperties, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { limitMagnification } from "./clearance";
import { parseSource } from "./document/parse";
import { colours, type GraphData, label } from "./graph";
import {
  type Camera,
  fitCamera,
  panCamera,
  projectPoint,
  zoomCamera,
} from "./lens";
import Sidebar from "./Sidebar";
import SidebarResizeHandle from "./SidebarResizeHandle";
import sampleSource from "./sample.yaml?raw";

const initialCamera: Camera = { x: 0, y: 0, zoom: 0.85 };
const nodeRadius = 43;
const initialDocument = parseSource(sampleSource);
if (!initialDocument.ok)
  throw new Error(`The Lensmap sample is invalid: ${initialDocument.error}`);
const sampleGraph = initialDocument.graph;

export default function App() {
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    capture: HTMLElement;
    active: boolean;
  } | null>(null);
  const suppressPointerClick = useRef(false);
  const [size, setSize] = useState({ width: 900, height: 640 });
  const [camera, setCamera] = useState(initialCamera);
  const [graph, setGraph] = useState(sampleGraph);
  const { nodes, edges } = graph;
  const [selected, setSelected] = useState(nodes[0]?.key ?? "");
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [strength, setStrength] = useState(1.1);
  const [overview, setOverview] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (overview) return;
      event.preventDefault();
      const pixels =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1);
      setCamera((current) =>
        zoomCamera(
          current,
          Math.exp(-Math.max(-400, Math.min(400, pixels)) * 0.0015),
        ),
      );
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [overview, size.height]);

  const shownCamera = overview ? fitCamera(nodes, size, nodeRadius) : camera;
  // Limit magnification before shared scene zoom, never changing circle centres.
  const projected = nodes.map((node) => ({
    ...projectPoint(
      node,
      { ...shownCamera, zoom: 1 },
      size,
      overview ? 0 : strength,
    ),
    node,
  }));
  const circles = overview
    ? projected
    : limitMagnification(projected, nodeRadius, strength);
  const positions = new Map(circles.map((point) => [point.node.key, point]));
  const active = nodes.find((node) => node.key === selected) ?? nodes[0];

  function focusNode(key: string) {
    const node = nodes.find((candidate) => candidate.key === key);
    if (!node) {
      setMessage(`The selected node is no longer in the graph.`);
      return;
    }
    setSelected(key);
    setOverview(false);
    setCamera((current) => ({ ...current, x: node.x, y: node.y }));
    setMessage("");
  }

  function focusFragment(fragment: string) {
    let id: string;
    try {
      id = decodeURIComponent(fragment);
    } catch {
      setMessage(`The fragment #${fragment} is not a valid URL fragment.`);
      return;
    }
    const node = nodes.find((candidate) => candidate.id === id);
    if (node) focusNode(node.key);
    else
      setMessage(
        `No node has id "${id}". Section anchors are not implemented yet.`,
      );
  }

  function applyGraph(next: GraphData) {
    const nextActive =
      (active?.id
        ? next.nodes.find((node) => node.id === active.id)
        : undefined) ?? next.nodes[0];
    setGraph(next);
    setSelected(nextActive?.key ?? "");
    setCamera({
      ...initialCamera,
      x: nextActive?.x ?? 0,
      y: nextActive?.y ?? 0,
    });
    setMessage("");
  }

  function stopDrag() {
    const previous = drag.current;
    if (previous?.capture.hasPointerCapture(previous.id)) {
      previous.capture.releasePointerCapture(previous.id);
    }
    drag.current = null;
    setDragging(false);
  }

  return (
    <main>
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ◎
          </span>
          <h1>Lensmap</h1>
          <span className="tag">spatial lens lab</span>
        </div>
        <p>Follow a thought. Keep the world around it.</p>
        <span className="phase">01 / web experiment</span>
      </header>

      <section
        className="workspace"
        aria-label="Lens exploration"
        style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
      >
        <div className="map-column">
          <div className="toolbar">
            <fieldset className="segmented">
              <legend className="sr-only">Map view</legend>
              <button
                type="button"
                aria-pressed={!overview}
                onClick={() => setOverview(false)}
              >
                Lens
              </button>
              <button
                type="button"
                aria-pressed={overview}
                onClick={() => setOverview(true)}
              >
                Overview
              </button>
            </fieldset>
            <label className="strength">
              Lens strength{" "}
              <input
                aria-label="Lens strength"
                type="range"
                min="0"
                max="1.4"
                step="0.05"
                value={strength}
                disabled={overview}
                onChange={(event) => setStrength(Number(event.target.value))}
              />
              <output>{strength.toFixed(2)}</output>
            </label>
            <button
              type="button"
              className="quiet"
              onClick={() => {
                setCamera({
                  ...initialCamera,
                  x: nodes[0]?.x ?? 0,
                  y: nodes[0]?.y ?? 0,
                });
                setSelected(nodes[0]?.key ?? "");
                setStrength(1.1);
                setOverview(false);
                setMessage("");
              }}
            >
              Reset view
            </button>
          </div>
          <div
            ref={canvas}
            className={`map ${dragging ? "dragging" : ""} ${overview ? "overview" : ""}`}
            role="application"
            aria-label="Spatial map"
            aria-describedby="map-help"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Arrow-key panning needs a focus target separate from node buttons.
            tabIndex={0}
            onPointerDown={(event) => {
              if (event.button !== 0 || !event.isPrimary) return;
              // A cancelled gesture may not produce a click to consume. A new
              // pointer gesture, including a zoom-control click, starts fresh.
              suppressPointerClick.current = false;
              const button = (
                event.target as Element
              ).closest<HTMLButtonElement>("button");
              if (overview || (button && !button.hasAttribute("data-node")))
                return;
              if (!button) event.currentTarget.focus({ preventScroll: true });
              // Capture on the original node so an unmoved pointer still clicks
              // its native button. Events bubble to the map throughout a drag.
              const capture = button ?? event.currentTarget;
              capture.setPointerCapture(event.pointerId);
              drag.current = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                startX: event.clientX,
                startY: event.clientY,
                capture,
                active: false,
              };
            }}
            onPointerMove={(event) => {
              const previous = drag.current;
              if (!previous || event.pointerId !== previous.id) return;
              if (
                !previous.active &&
                Math.hypot(
                  event.clientX - previous.startX,
                  event.clientY - previous.startY,
                ) < 4
              )
                return;
              if (!previous.active) {
                setDragging(true);
                suppressPointerClick.current = true;
                event.currentTarget.focus({ preventScroll: true });
              }
              const delta = {
                x: event.clientX - previous.x,
                y: event.clientY - previous.y,
              };
              setCamera((current) => panCamera(current, delta));
              drag.current = {
                ...previous,
                x: event.clientX,
                y: event.clientY,
                active: true,
              };
            }}
            onPointerUp={(event) => {
              if (drag.current?.id === event.pointerId) stopDrag();
            }}
            onPointerCancel={(event) => {
              if (drag.current?.id === event.pointerId) stopDrag();
            }}
            onLostPointerCapture={(event) => {
              if (drag.current?.id !== event.pointerId) return;
              drag.current = null;
              setDragging(false);
            }}
            onClickCapture={(event) => {
              // Keyboard-generated activation has detail zero and stays native.
              if (!suppressPointerClick.current || event.detail === 0) return;
              suppressPointerClick.current = false;
              event.preventDefault();
              event.stopPropagation();
            }}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget || overview) return;
              const deltas: Record<string, { x: number; y: number }> = {
                ArrowLeft: { x: 50, y: 0 },
                ArrowRight: { x: -50, y: 0 },
                ArrowUp: { x: 0, y: 50 },
                ArrowDown: { x: 0, y: -50 },
              };
              const delta = deltas[event.key];
              if (delta) {
                event.preventDefault();
                setCamera((current) => panCamera(current, delta));
              }
            }}
          >
            {!overview && <div className="focus-ring" aria-hidden="true" />}
            {!nodes.length && (
              <div className="empty-map">
                <h2>Start with a thought</h2>
                <p>Open the YAML playground and add an entry under nodes.</p>
              </div>
            )}
            <div
              className="graph-scene"
              style={{ transform: `scale(${shownCamera.zoom})` }}
            >
              <svg
                className="connections"
                width={size.width}
                height={size.height}
                aria-hidden="true"
              >
                <defs>
                  {Object.entries(colours).map(([branch, colour]) => (
                    <marker
                      key={branch}
                      id={`arrow-${branch}`}
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path
                        d="M 1 1 L 9 5 L 1 9"
                        fill="none"
                        stroke={colour}
                        strokeWidth="1.5"
                      />
                    </marker>
                  ))}
                </defs>
                {edges.map((edge) => {
                  const from = positions.get(edge.from);
                  const to = positions.get(edge.to);
                  if (!from || !to) return null;
                  const dx = to.x - from.x;
                  const dy = to.y - from.y;
                  const distance = Math.max(1, Math.hypot(dx, dy));
                  const start = {
                    x: from.x + (dx / distance) * nodeRadius * from.scale,
                    y: from.y + (dy / distance) * nodeRadius * from.scale,
                  };
                  const end = {
                    x: to.x - (dx / distance) * (nodeRadius * to.scale + 7),
                    y: to.y - (dy / distance) * (nodeRadius * to.scale + 7),
                  };
                  const bend = edge.kind === "cross" ? 42 : 0;
                  const radius = nodeRadius * from.scale;
                  const path =
                    edge.from === edge.to
                      ? `M ${from.x + radius * 0.7} ${from.y - radius * 0.7} C ${from.x + radius * 3} ${from.y - radius * 3} ${from.x - radius * 3} ${from.y - radius * 3} ${from.x - radius * 0.7} ${from.y - radius * 0.7}`
                      : `M ${start.x} ${start.y} Q ${(start.x + end.x) / 2 - (dy / distance) * bend} ${(start.y + end.y) / 2 + (dx / distance) * bend} ${end.x} ${end.y}`;
                  return (
                    <g key={edge.key}>
                      <path d={path} className="edge-halo" />
                      <path
                        data-edge={`${edge.from}-${edge.to}`}
                        data-kind={edge.kind}
                        d={path}
                        stroke={colours[to.node.branch]}
                        className={`edge ${edge.kind}`}
                        markerEnd={
                          edge.kind === "cross"
                            ? `url(#arrow-${to.node.branch})`
                            : undefined
                        }
                      />
                    </g>
                  );
                })}
              </svg>
              {nodes.map((node) => {
                const point = positions.get(node.key);
                if (!point) return null;
                return (
                  <button
                    type="button"
                    key={node.key}
                    className={`node ${selected === node.key ? "selected" : ""} ${node.unresolved ? "unresolved" : ""}`}
                    data-node={node.key}
                    data-scale={point.scale * shownCamera.zoom}
                    aria-label={label(node)}
                    aria-pressed={selected === node.key}
                    title={label(node)}
                    style={{
                      left: point.x,
                      top: point.y,
                      transform: `translate(-50%, -50%) scale(${point.scale})`,
                      borderColor: colours[node.branch],
                    }}
                    onClick={() => focusNode(node.key)}
                  >
                    <span>
                      {node.unresolved ? (
                        "?"
                      ) : (
                        <Markdown
                          allowedElements={[
                            "em",
                            "strong",
                            "code",
                            "del",
                            "br",
                          ]}
                          unwrapDisallowed
                        >
                          {node.title}
                        </Markdown>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="zoom-controls">
              <button
                type="button"
                aria-label="Zoom out"
                disabled={overview}
                onClick={() =>
                  setCamera((current) => zoomCamera(current, 1 / 1.2))
                }
              >
                −
              </button>
              <output aria-label="Zoom level">
                {Math.round(shownCamera.zoom * 100)}%
              </output>
              <button
                type="button"
                aria-label="Zoom in"
                disabled={overview}
                onClick={() => setCamera((current) => zoomCamera(current, 1.2))}
              >
                +
              </button>
            </div>
          </div>
          <footer className="map-footer">
            <p className="map-caption">
              {overview
                ? "UNDISTORTED / select a thought to return"
                : "SPATIAL FOCUS / pan through the centre"}
            </p>
            <p id="map-help">
              Drag map or thoughts · scroll to zoom · Tab to a thought, Enter to
              focus · arrow keys pan the focused map
            </p>
            <div className="legend">
              <span>━ branch</span>
              <span>┄➤ cross-link / cycle</span>
            </div>
          </footer>
        </div>

        <SidebarResizeHandle width={sidebarWidth} onResize={setSidebarWidth} />
        <Sidebar
          graph={graph}
          active={active}
          onFocus={focusNode}
          onFragment={focusFragment}
          onApply={applyGraph}
        />
      </section>
      <p className="sr-only" role="status">
        Selected thought: {active ? label(active) : "none"}. {message}
      </p>
      <footer className="page-footer">
        <span>
          {nodes.length} thoughts / {edges.length} explicit connections
        </span>
        <span>Source layout is stable. Magnification is a view.</span>
      </footer>
    </main>
  );
}
