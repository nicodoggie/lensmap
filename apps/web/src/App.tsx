import {
  type CSSProperties,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import NeighbourhoodContinuations from "./NeighbourhoodContinuations";
import {
  centralTarget,
  connectionTarget,
  type Direction,
  spatialTarget,
} from "./navigation";
import { neighbourhood } from "./neighbourhood";
import Sidebar from "./Sidebar";
import SidebarResizeHandle from "./SidebarResizeHandle";
import sampleSource from "./sample.yaml?raw";
import { useMapKeyboard } from "./useMapKeyboard";

const initialCamera: Camera = { x: 0, y: 0, zoom: 0.85 };
const nodeRadius = 43;
const initialDocument = parseSource(sampleSource);
if (!initialDocument.ok)
  throw new Error(`The Lensmap sample is invalid: ${initialDocument.error}`);
const sampleGraph = initialDocument.graph;

export default function App() {
  const canvas = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const pendingActivation = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doubleCandidate = useRef<string | null>(null);
  const cancelActivation = useCallback(() => {
    if (pendingActivation.current !== null)
      clearTimeout(pendingActivation.current);
    pendingActivation.current = null;
    doubleCandidate.current = null;
  }, []);
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
  const [neighbourhoodStrength, setNeighbourhoodStrength] = useState(1.1);
  const [overview, setOverview] = useState(false);
  const [inNeighbourhood, setInNeighbourhood] = useState(false);
  const [neighbourhoodCamera, setNeighbourhoodCamera] = useState({
    x: 0,
    y: 0,
    zoom: 1,
  });
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [keyboardTarget, setKeyboardTarget] = useState<string>();
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [maximumPanSpeed, setMaximumPanSpeed] = useState(900);
  const returnOverview = useRef(false);
  const keyboard = useMapKeyboard(canvas, {
    canPan: !overview,
    maximum: maximumPanSpeed,
    onIntent: cancelActivation,
    onPan: panView,
    onZoom: zoomView,
    onSpatial: moveTarget,
    onTraverse: traverseTarget,
    onAccept: () => {
      if (target) focusNode(target.key);
    },
    onToggle: () => {
      if (target) toggleNeighbourhood(target.key);
    },
    onEscape: restoreMap,
  });
  const setViewCamera = inNeighbourhood ? setNeighbourhoodCamera : setCamera;
  const shownStrength = inNeighbourhood ? neighbourhoodStrength : strength;
  const setViewStrength = inNeighbourhood
    ? setNeighbourhoodStrength
    : setStrength;
  const local = useMemo(
    () => (inNeighbourhood ? neighbourhood(graph, selected, nodeRadius) : null),
    [graph, inNeighbourhood, selected],
  );

  useEffect(() => cancelActivation, [cancelActivation]);

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
      cancelActivation();
      keyboard.stop();
      if (overview) return;
      event.preventDefault();
      const pixels =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1);
      setViewCamera((current) =>
        zoomCamera(
          current,
          Math.exp(-Math.max(-400, Math.min(400, pixels)) * 0.0015),
        ),
      );
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [overview, size.height, setViewCamera, cancelActivation, keyboard.stop]);

  const shownCamera = inNeighbourhood
    ? neighbourhoodCamera
    : overview
      ? fitCamera(nodes, size, nodeRadius)
      : camera;
  // Limit magnification before shared scene zoom, never changing circle centres.
  const projected = (local?.nodes ?? nodes).map((node) => ({
    ...projectPoint(
      node,
      { ...shownCamera, zoom: 1 },
      size,
      overview ? 0 : shownStrength,
    ),
    node,
  }));
  const circles = overview
    ? projected
    : limitMagnification(projected, nodeRadius, shownStrength);
  const positions = new Map(circles.map((point) => [point.node.key, point]));
  const navigationPoints = circles.map((point) => ({
    key: point.node.key,
    x: (point.x - size.width / 2) * shownCamera.zoom,
    y: (point.y - size.height / 2) * shownCamera.zoom,
  }));
  const visiblePoints = navigationPoints.filter(
    (point) =>
      Math.abs(point.x) <= size.width / 2 &&
      Math.abs(point.y) <= size.height / 2,
  );
  const target =
    keyboardTarget === undefined
      ? centralTarget(visiblePoints)
      : visiblePoints.find((point) => point.key === keyboardTarget);
  const targetNode = nodes.find((node) => node.key === target?.key);
  const active = nodes.find((node) => node.key === selected) ?? nodes[0];
  const incident = edges.filter(
    (edge) => edge.from === active?.key || edge.to === active?.key,
  );
  const connectedEdges = new Set(incident.map((edge) => edge.key));
  const connectedNodes = new Set(
    incident.flatMap((edge) => [edge.from, edge.to]),
  );
  // Paint selected routes last: unrelated dark edge halos must not cover them.
  const drawnEdges = [
    ...(local?.edges ?? edges).filter((edge) => !connectedEdges.has(edge.key)),
    ...incident,
  ];

  function panView(delta: { x: number; y: number }) {
    setKeyboardTarget(undefined);
    setViewCamera((current) => panCamera(current, delta));
  }

  function zoomView(factor: number) {
    cancelActivation();
    keyboard.stop();
    if (!overview) setViewCamera((current) => zoomCamera(current, factor));
  }

  function moveTarget(direction: Direction) {
    const next = spatialTarget(visiblePoints, target?.key, direction);
    if (next) setKeyboardTarget(next.key);
  }

  function traverseTarget(direction: Direction) {
    if (!target) return;
    const next = connectionTarget(
      graph,
      target.key,
      direction,
      navigationPoints,
    );
    if (next) focusNode(next.key);
  }

  function restoreMap() {
    if (!inNeighbourhood) return;
    cancelActivation();
    keyboard.stop();
    stopDrag();
    setInNeighbourhood(false);
    setOverview(returnOverview.current);
    setKeyboardTarget(undefined);
    revealScene();
  }

  function retainViewerFocus(key: string, nextNeighbourhood: boolean) {
    if (!nextNeighbourhood) return;
    const viewer = canvas.current;
    const focused = document.activeElement;
    if (!viewer?.contains(focused)) return;
    const focusedKey =
      focused instanceof Element
        ? focused.closest<HTMLElement>("[data-node]")?.dataset.node
        : undefined;
    // Move focus before React removes its button, but leave surviving buttons
    // and controls outside the viewer alone. Visibility is one-hop adjacency.
    if (
      focusedKey &&
      focusedKey !== key &&
      !edges.some(
        (edge) =>
          (edge.from === key && edge.to === focusedKey) ||
          (edge.to === key && edge.from === focusedKey),
      )
    )
      viewer.focus({ preventScroll: true });
  }

  function focusNode(key: string) {
    cancelActivation();
    keyboard.stop();
    const node = nodes.find((candidate) => candidate.key === key);
    if (!node) {
      setMessage(`The selected node is no longer in the graph.`);
      return;
    }
    retainViewerFocus(key, inNeighbourhood);
    setSelected(key);
    setKeyboardTarget(key);
    setOverview(false);
    if (inNeighbourhood) {
      setNeighbourhoodCamera((current) => ({ ...current, x: 0, y: 0 }));
      revealScene();
    } else {
      setCamera((current) => ({ ...current, x: node.x, y: node.y }));
    }
    setMessage("");
  }

  function revealScene() {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      scene.current?.animate([{ opacity: 0.4 }, { opacity: 1 }], {
        duration: 160,
        easing: "ease-out",
      });
  }

  function toggleNeighbourhood(key: string) {
    const node = nodes.find((candidate) => candidate.key === key);
    if (!node) return;
    cancelActivation();
    keyboard.stop();
    stopDrag();
    retainViewerFocus(key, !inNeighbourhood);
    setSelected(key);
    setKeyboardTarget(key);
    if (!inNeighbourhood) returnOverview.current = overview;
    setOverview(false);
    setInNeighbourhood(!inNeighbourhood);
    if (inNeighbourhood)
      setCamera((current) => ({ ...current, x: node.x, y: node.y }));
    else {
      setNeighbourhoodCamera({ x: 0, y: 0, zoom: 1 });
      setNeighbourhoodStrength(strength);
    }
    setMessage("");
    revealScene();
  }

  function showMap(nextOverview: boolean) {
    cancelActivation();
    keyboard.stop();
    stopDrag();
    if (inNeighbourhood && active) {
      setCamera((current) => ({ ...current, x: active.x, y: active.y }));
      revealScene();
    }
    setInNeighbourhood(false);
    setOverview(nextOverview);
    setKeyboardTarget(undefined);
  }

  function activateNode(event: MouseEvent<HTMLButtonElement>, key: string) {
    if (event.detail === 0) {
      focusNode(key);
      return;
    }
    if (event.detail !== 1) return;
    cancelActivation();
    doubleCandidate.current = key;
    // Hold geometry still while the browser resolves a possible double-click.
    pendingActivation.current = setTimeout(() => focusNode(key), 350);
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
    cancelActivation();
    keyboard.stop();
    stopDrag();
    setInNeighbourhood(false);
    const nextActive =
      (active?.id
        ? next.nodes.find((node) => node.id === active.id)
        : undefined) ?? next.nodes[0];
    setGraph(next);
    setSelected(nextActive?.key ?? "");
    setKeyboardTarget(undefined);
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
        onPointerDownCapture={(event) => {
          keyboard.stop();
          if (!(event.target as Element).closest("[data-node]"))
            cancelActivation();
        }}
        onKeyDown={cancelActivation}
      >
        <div className="map-column">
          <div className="toolbar">
            <fieldset className="segmented">
              <legend className="sr-only">Map view</legend>
              <button
                type="button"
                aria-pressed={!overview && !inNeighbourhood}
                onClick={() => showMap(false)}
              >
                Lens
              </button>
              <button
                type="button"
                aria-pressed={overview}
                onClick={() => showMap(true)}
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
                value={shownStrength}
                disabled={overview}
                onChange={(event) => {
                  cancelActivation();
                  setViewStrength(Number(event.target.value));
                }}
              />
              <output>{shownStrength.toFixed(2)}</output>
            </label>
            <label className="strength">
              Pan max
              <input
                aria-label="Maximum keyboard pan speed"
                type="range"
                min="120"
                max="1800"
                step="60"
                value={maximumPanSpeed}
                onChange={(event) => {
                  keyboard.stop();
                  setMaximumPanSpeed(Number(event.target.value));
                }}
              />
              <output>{maximumPanSpeed} px/s</output>
            </label>
            <button
              type="button"
              className="neighbourhood-action"
              disabled={!active}
              onClick={() => active && toggleNeighbourhood(active.key)}
            >
              {inNeighbourhood ? "Return to map" : "Explore neighbourhood"}
            </button>
            {inNeighbourhood && active && (
              <span className="neighbourhood-label">
                Neighbourhood · {label(active)}
              </span>
            )}
            <button
              type="button"
              className="quiet"
              onClick={() => {
                cancelActivation();
                keyboard.stop();
                stopDrag();
                setInNeighbourhood(false);
                setCamera({
                  ...initialCamera,
                  x: nodes[0]?.x ?? 0,
                  y: nodes[0]?.y ?? 0,
                });
                setSelected(nodes[0]?.key ?? "");
                setKeyboardTarget(undefined);
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
            className={`map ${dragging ? "dragging" : ""} ${overview ? "overview" : ""} ${inNeighbourhood ? "neighbourhood" : ""}`}
            data-view={
              inNeighbourhood ? "neighbourhood" : overview ? "overview" : "lens"
            }
            role="application"
            aria-label="Spatial map"
            aria-describedby="map-help"
            aria-activedescendant={
              keyboardActive && target ? `thought-${target.key}` : undefined
            }
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Arrow-key panning needs a focus target separate from node buttons.
            tabIndex={0}
            onFocusCapture={(event) => {
              const node = (event.target as Element).closest<HTMLElement>(
                "[data-node]",
              );
              setKeyboardActive(event.target === event.currentTarget || !!node);
              if (node) setKeyboardTarget(node.dataset.node);
            }}
            onBlurCapture={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              )
                setKeyboardActive(false);
            }}
            onPointerDown={(event) => {
              if (event.button !== 0 || !event.isPrimary) return;
              // A cancelled gesture may not produce a click to consume. A new
              // pointer gesture, including a zoom-control click, starts fresh.
              suppressPointerClick.current = false;
              const button = (
                event.target as Element
              ).closest<HTMLButtonElement>("button");
              if (button && !button.hasAttribute("data-node"))
                cancelActivation();
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
                cancelActivation();
                setDragging(true);
                suppressPointerClick.current = true;
                event.currentTarget.focus({ preventScroll: true });
              }
              const delta = {
                x: event.clientX - previous.x,
                y: event.clientY - previous.y,
              };
              panView(delta);
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
              cancelActivation();
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
          >
            {!overview && <div className="focus-ring" aria-hidden="true" />}
            {!nodes.length && (
              <div className="empty-map">
                <h2>Start with a thought</h2>
                <p>Open the YAML playground and add an entry under nodes.</p>
              </div>
            )}
            <div
              ref={scene}
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
                {local && (
                  <NeighbourhoodContinuations
                    continuations={local.continuations}
                    positions={positions}
                    centreKey={selected}
                    nodes={nodes}
                    nodeRadius={nodeRadius}
                  />
                )}
                {drawnEdges.map((edge) => {
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
                  let bend = edge.kind === "cross" ? 42 : 0;
                  const centre = positions.get(selected);
                  if (local && !connectedEdges.has(edge.key) && centre) {
                    // Bow away from the centre on either side of the chord;
                    // a fixed sign can make an adjacent route look incident.
                    const side =
                      (((start.x + end.x) / 2 - centre.x) * -dy +
                        ((start.y + end.y) / 2 - centre.y) * dx) /
                      distance;
                    bend = side < 0 ? -190 : 190;
                  }
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
                        data-edge-key={edge.key}
                        data-kind={edge.kind}
                        d={path}
                        stroke={colours[to.node.branch]}
                        style={{ color: colours[to.node.branch] }}
                        className={`edge ${edge.kind} ${connectedEdges.has(edge.key) ? "connected" : local ? "context" : ""}`}
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
              {(local?.nodes ?? nodes).map((node) => {
                const point = positions.get(node.key);
                if (!point) return null;
                return (
                  <button
                    type="button"
                    key={node.key}
                    id={`thought-${node.key}`}
                    className={`node ${selected === node.key ? "selected" : ""} ${connectedNodes.has(node.key) ? "connected" : ""} ${node.unresolved ? "unresolved" : ""}`}
                    data-node={node.key}
                    data-keyboard-target={
                      keyboardActive && target?.key === node.key
                        ? "true"
                        : undefined
                    }
                    data-scale={point.scale * shownCamera.zoom}
                    aria-label={label(node)}
                    aria-pressed={selected === node.key}
                    title={label(node)}
                    style={
                      {
                        left: point.x,
                        top: point.y,
                        transform: `translate(-50%, -50%) scale(${point.scale})`,
                        borderColor: colours[node.branch],
                        "--branch-colour": colours[node.branch],
                      } as CSSProperties
                    }
                    onClick={(event) => activateNode(event, node.key)}
                    onDoubleClick={() => {
                      const eligible = doubleCandidate.current === node.key;
                      cancelActivation();
                      if (eligible) toggleNeighbourhood(node.key);
                      else focusNode(node.key);
                    }}
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
                onClick={() => zoomView(1 / 1.2)}
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
                onClick={() => zoomView(1.2)}
              >
                +
              </button>
            </div>
          </div>
          <footer className="map-footer">
            <p className="map-caption">
              {inNeighbourhood
                ? `NEIGHBOURHOOD / ${active ? label(active) : ""}`
                : overview
                  ? "UNDISTORTED / select a thought to return"
                  : "SPATIAL FOCUS / pan through the centre"}
            </p>
            <p id="map-help">
              Drag / arrows pan · hold to accelerate · Ctrl+= / Ctrl+- zoom ·
              Ctrl+arrows browse · Shift+arrows follow connections · Space
              focuses · Enter / double-click switches views · Esc restores map
            </p>
            {keyboardActive && (
              <p className="keyboard-target-label">
                Target:{" "}
                {targetNode ? label(targetNode) : "none in the central region"}
              </p>
            )}
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
        Selected thought: {active ? label(active) : "none"}.{" "}
        {inNeighbourhood
          ? "Neighbourhood view."
          : overview
            ? "Overview."
            : "Lens map."}{" "}
        {message}
        {keyboardActive &&
          ` Keyboard target: ${targetNode ? label(targetNode) : "none"}.`}
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
