import {
  connectionWording,
  resolveThoughtAnchor,
  thoughtAnchors,
} from "@lensmap/document";
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Markdown from "react-markdown";
import ConnectionChooser from "./ConnectionChooser";
import ConnectionGap, { BlockingMarker } from "./ConnectionGap";
import { limitMagnification } from "./clearance";
import { connectionAppearance } from "./connection-appearance";
import { edgeLanes } from "./edge-routing";
import { colours, type GraphData, type GraphNode, label } from "./graph";
import {
  type Camera,
  fitCamera,
  panCamera,
  projectPoint,
  zoomCamera,
} from "./lens";
import NeighbourhoodContinuations from "./NeighbourhoodContinuations";
import {
  type ConnectionChoice,
  centralTarget,
  type Direction,
  spatialTarget,
  stepConnectionChoice,
} from "./navigation";
import { neighbourhood } from "./neighbourhood";
import SidebarResizeHandle from "./SidebarResizeHandle";
import { useMapKeyboard } from "./useMapKeyboard";
import ViewerInspector from "./ViewerInspector";
import { reconcileViewer } from "./viewer-state";

const initialCamera: Camera = { x: 0, y: 0, zoom: 0.85 };
const nodeRadius = 43;
export interface ViewerState {
  selected: string;
  camera: Camera;
  strength: number;
  overview: boolean;
  inNeighbourhood: boolean;
  neighbourhoodCamera: Camera;
  neighbourhoodStrength: number;
  returnOverview: boolean;
}

export interface ViewerSidebarContext {
  thoughtHref?: string;
  onActivatePortal?: (node: GraphNode) => void;
  graph: GraphData;
  active?: GraphNode;
  onFocus: (key: string) => void;
  onFragment: (id: string) => void;
}

export interface ViewerProps {
  embedded?: boolean;
  navigationControls?: ReactNode;
  thoughtLink?: (anchor: string) => string;
  onActivatePortal?: (node: GraphNode) => void;
  initialState?: ViewerState;
  initialTarget?: string;
  initialOverview?: boolean;
  onStateChange?: (state: ViewerState) => void;
  graph: GraphData;
  updateMode?: "replace" | "live";
  focusRequest?: { key: string; sequence: number };
  onRevealSource?: (key: string) => void;
  showInspector?: boolean;
  renderSidebar?: (context: ViewerSidebarContext) => ReactNode;
  renderExternalInspector?: (context: ViewerSidebarContext) => ReactNode;
}

export default function Viewer({
  graph,
  embedded = false,
  navigationControls,
  thoughtLink,
  onActivatePortal,
  initialState,
  initialTarget,
  initialOverview,
  onStateChange,
  updateMode = "live",
  focusRequest,
  onRevealSource,
  showInspector = true,
  renderSidebar,
  renderExternalInspector,
}: ViewerProps) {
  const scope = useId();
  const anchors = useMemo(() => thoughtAnchors(graph.nodes), [graph.nodes]);
  const entryNode = graph.nodes.find((n) => n.key === initialTarget);
  const restoredNode = graph.nodes.find(
    (n) => n.key === initialState?.selected,
  );
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
  const [camera, setCamera] = useState(
    initialState?.camera ??
      (entryNode
        ? { ...initialCamera, x: entryNode.x, y: entryNode.y }
        : initialCamera),
  );
  const { nodes, edges } = graph;
  const lanes = useMemo(() => edgeLanes(edges), [edges]);
  const [selected, setSelected] = useState(
    restoredNode?.key ?? entryNode?.key ?? nodes[0]?.key ?? "",
  );
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const [strength, setStrength] = useState(initialState?.strength ?? 1.1);
  const [neighbourhoodStrength, setNeighbourhoodStrength] = useState(
    initialState?.neighbourhoodStrength ?? 1.1,
  );
  const [overview, setOverview] = useState(
    initialState?.overview ?? initialOverview ?? false,
  );
  const [inNeighbourhood, setInNeighbourhood] = useState(
    !!restoredNode && (initialState?.inNeighbourhood ?? false),
  );
  const [neighbourhoodCamera, setNeighbourhoodCamera] = useState(
    initialState?.neighbourhoodCamera ?? {
      x: 0,
      y: 0,
      zoom: 1,
    },
  );
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [keyboardTarget, setKeyboardTarget] = useState<string>();
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [maximumPanSpeed, setMaximumPanSpeed] = useState(900);
  const [connectionChoice, setConnectionChoice] = useState<ConnectionChoice>();
  const dismissConnectionChoice = useCallback(() => {
    const focused = document.activeElement;
    if (
      focused instanceof Element &&
      canvas.current?.contains(focused) &&
      focused.closest("[data-connection-chooser]")
    ) {
      canvas.current.focus({ preventScroll: true });
    }
    setConnectionChoice(undefined);
  }, []);
  const returnOverview = useRef(initialState?.returnOverview ?? false);
  const reportState = useEffectEvent(() =>
    onStateChange?.({
      selected,
      camera,
      strength,
      overview,
      inNeighbourhood,
      neighbourhoodCamera,
      neighbourhoodStrength,
      returnOverview: returnOverview.current,
    }),
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: Report when view values change, while the effect event keeps the host callback current.
  useEffect(() => {
    reportState();
  }, [
    selected,
    camera,
    strength,
    overview,
    inNeighbourhood,
    neighbourhoodCamera,
    neighbourhoodStrength,
  ]);
  const keyboard = useMapKeyboard(canvas, {
    canPan: !overview,
    maximum: maximumPanSpeed,
    onIntent: cancelActivation,
    onPan: panView,
    onZoom: zoomView,
    onSpatial: moveTarget,
    onConnection: previewConnection,
    onAccept: () => {
      if (target) focusNode(target.key);
    },
    onToggle: () => {
      if (targetNode?.destination) {
        dismissConnectionChoice();
        onActivatePortal?.(targetNode);
      } else if (target) toggleNeighbourhood(target.key);
    },
    onEscape: escapeNavigation,
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
      dismissConnectionChoice();
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [dismissConnectionChoice]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-connection-chooser]")
      )
        return;
      cancelActivation();
      keyboard.stop();
      dismissConnectionChoice();
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
  }, [
    overview,
    size.height,
    setViewCamera,
    cancelActivation,
    keyboard.stop,
    dismissConnectionChoice,
  ]);

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
  const ordinaryTarget =
    keyboardTarget === undefined
      ? centralTarget(visiblePoints)
      : visiblePoints.find((point) => point.key === keyboardTarget);
  const pendingConnection =
    connectionChoice?.candidates[connectionChoice.index];
  const target = connectionChoice ? pendingConnection?.node : ordinaryTarget;
  const targetNode = nodes.find((node) => node.key === target?.key);
  const choiceOrigin = nodes.find(
    (node) => node.key === connectionChoice?.origin,
  );
  const previewEdges = new Set(
    pendingConnection?.routes.map((route) => route.edge.key),
  );
  const visibleKeys = new Set(visiblePoints.map((point) => point.key));
  const active = nodes.find((node) => node.key === selected) ?? nodes[0];
  const incident = edges.filter(
    (edge) => edge.from === active?.key || edge.to === active?.key,
  );
  const connectedEdges = new Set(incident.map((edge) => edge.key));
  const connectedNodes = new Set(
    incident.flatMap((edge) => [edge.from, edge.to]),
  );
  // Paint selected routes last: unrelated dark edge halos must not cover them.
  const sceneEdges = local?.edges ?? edges;
  const drawnEdges = [
    ...sceneEdges.filter(
      (edge) => !connectedEdges.has(edge.key) && !previewEdges.has(edge.key),
    ),
    ...sceneEdges.filter(
      (edge) => connectedEdges.has(edge.key) && !previewEdges.has(edge.key),
    ),
    ...sceneEdges.filter((edge) => previewEdges.has(edge.key)),
  ];

  function panView(delta: { x: number; y: number }) {
    dismissConnectionChoice();
    setKeyboardTarget(undefined);
    setViewCamera((current) => panCamera(current, delta));
  }

  function zoomView(factor: number) {
    cancelActivation();
    keyboard.stop();
    dismissConnectionChoice();
    if (!overview) setViewCamera((current) => zoomCamera(current, factor));
  }

  function moveTarget(direction: Direction) {
    const from = visibleKeys.has(target?.key ?? "")
      ? target?.key
      : (connectionChoice?.origin ?? ordinaryTarget?.key);
    const next = spatialTarget(visiblePoints, from, direction);
    dismissConnectionChoice();
    setKeyboardTarget(next?.key ?? from);
  }

  function previewConnection(direction: Direction) {
    const origin = connectionChoice?.origin ?? target?.key;
    if (origin)
      setConnectionChoice((previous) =>
        stepConnectionChoice(
          graph,
          origin,
          direction,
          navigationPoints,
          previous,
        ),
      );
  }

  function escapeNavigation() {
    if (connectionChoice) dismissConnectionChoice();
    else restoreMap();
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
    dismissConnectionChoice();
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
    dismissConnectionChoice();
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
    dismissConnectionChoice();
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
    const key = resolveThoughtAnchor(nodes, id);
    const node = nodes.find((candidate) => candidate.key === key);
    if (node) focusNode(node.key);
    else setMessage(`No thought has anchor "${id}".`);
  }

  const previousGraph = useRef(graph);
  const lastRequest = useRef<{ key: string; sequence: number } | undefined>(
    undefined,
  );
  const focusedBeforeUpdate =
    typeof document === "undefined" ? null : document.activeElement;
  const hadViewerFocus = !!canvas.current?.contains(focusedBeforeUpdate);
  const reconcileGraph = useEffectEvent(() => {
    if (previousGraph.current === graph) return;
    const next = reconcileViewer(
      previousGraph.current,
      graph,
      selected,
      camera,
      updateMode,
    );
    previousGraph.current = graph;
    cancelActivation();
    keyboard.stop();
    stopDrag();
    setConnectionChoice(undefined);
    setKeyboardTarget(undefined);
    setSelected(next.selected);
    setCamera(next.camera);
    if (next.reset || !graph.nodes.some((node) => node.key === selected))
      setInNeighbourhood(false);
    setMessage("");
  });
  useLayoutEffect(() => {
    reconcileGraph();
    // Only repair focus that belonged to a control removed by this update.
    if (
      hadViewerFocus &&
      focusedBeforeUpdate &&
      !focusedBeforeUpdate.isConnected
    )
      canvas.current?.focus({ preventScroll: true });
  });

  const receiveFocus = useEffectEvent(() => {
    if (
      !focusRequest ||
      (lastRequest.current?.key === focusRequest.key &&
        lastRequest.current?.sequence === focusRequest.sequence)
    )
      return;
    lastRequest.current = focusRequest;
    const node = graph.nodes.find(
      (candidate) => candidate.key === focusRequest.key,
    );
    if (!node) return;
    cancelActivation();
    keyboard.stop();
    stopDrag();
    // Unlike local navigation, an external request never transfers DOM focus.
    setConnectionChoice(undefined);
    setSelected(node.key);
    setKeyboardTarget(node.key);
    setInNeighbourhood(false);
    setOverview(false);
    setCamera((current) => ({ ...current, x: node.x, y: node.y }));
    setMessage("");
  });
  useLayoutEffect(() => {
    receiveFocus();
  });

  function stopDrag() {
    const previous = drag.current;
    if (previous?.capture.hasPointerCapture(previous.id)) {
      previous.capture.releasePointerCapture(previous.id);
    }
    drag.current = null;
    setDragging(false);
  }

  const Container = embedded ? "div" : "main";
  const sidebarContext: ViewerSidebarContext = {
    graph,
    active,
    thoughtHref: active
      ? thoughtLink?.(anchors.get(active.key) ?? active.key)
      : undefined,
    onActivatePortal,
    onFocus: focusNode,
    onFragment: focusFragment,
  };

  return (
    <Container
      className={`lensmap-viewer${embedded ? " lensmap-embedded" : ""}`}
    >
      {!embedded && (
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
      )}

      <section
        className={`workspace${showInspector ? "" : " canvas-only"}`}
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
            {navigationControls}
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
                  dismissConnectionChoice();
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
                dismissConnectionChoice();
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
              keyboardActive && target
                ? connectionChoice
                  ? `connection-option-${target.key}`
                  : `${scope}-thought-${target.key}`
                : undefined
            }
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Arrow-key panning needs a focus target separate from node buttons.
            tabIndex={0}
            onFocusCapture={(event) => {
              const node = (event.target as Element).closest<HTMLElement>(
                "[data-node]",
              );
              setKeyboardActive(event.target === event.currentTarget || !!node);
              if (node) {
                dismissConnectionChoice();
                setKeyboardTarget(node.dataset.node);
              }
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
              if (
                (event.target as Element).closest("[data-connection-chooser]")
              )
                return;
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
                <p>Supply a document with thoughts to explore.</p>
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
              >
                <title>Explicit thought connections</title>
                <defs>
                  {Object.entries(colours).map(([branch, colour]) => (
                    <marker
                      key={branch}
                      id={`${scope}-arrow-${branch}`}
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
                  {Object.entries(colours).map(([branch, colour]) => (
                    <BlockingMarker
                      key={`bar-${branch}`}
                      id={`${scope}-bar-${branch}`}
                      colour={colour}
                    />
                  ))}
                  <BlockingMarker id={`${scope}-bar-gap`} colour="black" gap />
                </defs>
                {local && (
                  <NeighbourhoodContinuations
                    continuations={local.continuations}
                    positions={positions}
                    centreKey={selected}
                    nodes={nodes}
                    nodeRadius={nodeRadius}
                    previewEdges={previewEdges}
                    markerPrefix={scope}
                  />
                )}
                {drawnEdges.map((edge) => {
                  const appearance = connectionAppearance(edge.type);
                  const from = positions.get(edge.from);
                  const to = positions.get(edge.to);
                  if (!from || !to) return null;
                  const description = `${label(from.node)} ${connectionWording(edge.type, "outgoing")} ${label(to.node)}`;
                  const dx = to.x - from.x;
                  const dy = to.y - from.y;
                  const distance = Math.max(1, Math.hypot(dx, dy));
                  const start = {
                    x: from.x + (dx / distance) * nodeRadius * from.scale,
                    y: from.y + (dy / distance) * nodeRadius * from.scale,
                  };
                  // Unmarked targets meet the outline; only decorations need space.
                  const targetRadius =
                    nodeRadius * to.scale + (appearance.end ? 7 : 0);
                  const end = {
                    x: to.x - (dx / distance) * targetRadius,
                    y: to.y - (dy / distance) * targetRadius,
                  };
                  const lane = lanes.get(edge.key);
                  let bend =
                    (lane?.count ?? 0) > 1
                      ? (lane?.bend ?? 0)
                      : edge.kind === "cross"
                        ? 42
                        : 0;
                  const centre = positions.get(selected);
                  if (local && !connectedEdges.has(edge.key) && centre) {
                    // Bow away from the centre on either side of the chord;
                    // a fixed sign can make an adjacent route look incident.
                    const side =
                      (((start.x + end.x) / 2 - centre.x) * -dy +
                        ((start.y + end.y) / 2 - centre.y) * dx) /
                      distance;
                    bend =
                      (side < 0 ? -1 : 1) * (190 + (lane?.index ?? 0) * 60);
                  }
                  const radius = nodeRadius * from.scale;
                  const loop = radius * (3 + (lane?.index ?? 0));
                  const points =
                    edge.from === edge.to
                      ? [
                          {
                            x: from.x + radius * 0.7,
                            y: from.y - radius * 0.7,
                          },
                          { x: from.x + loop, y: from.y - loop },
                          { x: from.x - loop, y: from.y - loop },
                          {
                            x: from.x - radius * 0.7,
                            y: from.y - radius * 0.7,
                          },
                        ]
                      : [
                          start,
                          {
                            x: (start.x + end.x) / 2 - (dy / distance) * bend,
                            y: (start.y + end.y) / 2 + (dx / distance) * bend,
                          },
                          end,
                        ];
                  const path =
                    points.length === 4
                      ? `M ${points[0].x} ${points[0].y} C ${points[1].x} ${points[1].y} ${points[2].x} ${points[2].y} ${points[3].x} ${points[3].y}`
                      : `M ${points[0].x} ${points[0].y} Q ${points[1].x} ${points[1].y} ${points[2].x} ${points[2].y}`;
                  const edgeClass = `edge ${edge.kind} ${connectedEdges.has(edge.key) ? "connected" : local ? "context" : ""} ${previewEdges.has(edge.key) ? "connection-preview" : ""}`;
                  const painted = (
                    <>
                      <path d={path} className="edge-halo" />
                      <path
                        data-edge={`${edge.from}-${edge.to}`}
                        data-edge-key={edge.key}
                        data-connection-preview={
                          previewEdges.has(edge.key) ? "true" : undefined
                        }
                        data-kind={edge.kind}
                        data-type={edge.type ?? "connected"}
                        strokeDasharray={appearance.dashed ? "7 6" : undefined}
                        d={path}
                        stroke={colours[to.node.branch]}
                        style={{ color: colours[to.node.branch] }}
                        className={edgeClass}
                        markerStart={
                          appearance.start
                            ? `url(#${scope}-${appearance.start}-${to.node.branch})`
                            : undefined
                        }
                        markerEnd={
                          appearance.end
                            ? `url(#${scope}-${appearance.end}-${to.node.branch})`
                            : undefined
                        }
                      />
                    </>
                  );
                  return (
                    <g key={edge.key}>
                      {appearance.end === "bar" ? (
                        <ConnectionGap
                          path={path}
                          points={points}
                          className={edgeClass}
                          markerId={`${scope}-bar-gap`}
                        >
                          {painted}
                        </ConnectionGap>
                      ) : (
                        painted
                      )}
                      <path
                        className="edge-hit"
                        d={path}
                        data-edge-hit={edge.key}
                      >
                        <title>{description}</title>
                      </path>
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
                    id={`${scope}-thought-${node.key}`}
                    data-anchor={anchors.get(node.key)}
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
                      if (node.destination) onActivatePortal?.(node);
                      else if (eligible) toggleNeighbourhood(node.key);
                      else focusNode(node.key);
                    }}
                  >
                    {node.destination && (
                      <span
                        role="img"
                        className="destination-icon"
                        data-destination={node.destination.kind}
                        aria-label={
                          node.destination.kind === "map_link"
                            ? "Map portal"
                            : "External link"
                        }
                      >
                        {node.destination.kind === "map_link" ? (
                          "🌀"
                        ) : (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              d="M 14 3 H 21 V 10 M 21 3 L 10 14 M 10 5 H 4 V 21 H 20 V 14"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                            />
                          </svg>
                        )}
                      </span>
                    )}
                    <span
                      className="thought-anchor"
                      id={`${scope}-anchor-${encodeURIComponent(anchors.get(node.key) ?? node.key)}`}
                      aria-hidden="true"
                    />
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
            {connectionChoice && choiceOrigin && (
              <ConnectionChooser
                choice={connectionChoice}
                origin={choiceOrigin}
                visibleKeys={visibleKeys}
                onPick={(index) => {
                  setConnectionChoice((current) =>
                    current ? { ...current, index } : current,
                  );
                  canvas.current?.focus({ preventScroll: true });
                }}
                onAccept={() => {
                  if (pendingConnection) focusNode(pendingConnection.node.key);
                }}
                onActivatePortal={onActivatePortal}
                onCancel={dismissConnectionChoice}
              />
            )}
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
              Ctrl+arrows browse · Shift+arrows choose exits · Space travels ·
              Enter / double-click switches views · Esc cancels choice /
              restores map
            </p>
            {keyboardActive && (
              <p className="keyboard-target-label">
                Target:{" "}
                {targetNode
                  ? `${label(targetNode)}${visibleKeys.has(targetNode.key) ? "" : " (outside this view)"}`
                  : "none in the central region"}
              </p>
            )}
            <div className="legend">
              <span>━ connected</span>
              <span>┄ optional · → sequence · ─| | prevents</span>
            </div>
          </footer>
        </div>

        {showInspector && (
          <SidebarResizeHandle
            width={sidebarWidth}
            onResize={setSidebarWidth}
          />
        )}
        {showInspector &&
          (renderSidebar ? (
            renderSidebar(sidebarContext)
          ) : (
            <ViewerInspector
              {...sidebarContext}
              onRevealSource={onRevealSource}
            />
          ))}
      </section>
      {renderExternalInspector?.(sidebarContext)}
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
        {connectionChoice &&
          choiceOrigin &&
          ` Connection choice from ${label(choiceOrigin)}. ${pendingConnection ? `${label(pendingConnection.node)}${visibleKeys.has(pendingConnection.node.key) ? "" : ", outside this view"}. Space travels; Enter switches view.` : "No connections in this direction."} Escape cancels choice.`}
      </p>
      <footer className="page-footer">
        <span>
          {nodes.length} thoughts / {edges.length} explicit connections
        </span>
        <span>Source layout is stable. Magnification is a view.</span>
      </footer>
    </Container>
  );
}
