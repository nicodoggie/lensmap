import {
  type RefObject,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
} from "react";
import type { Point } from "./lens";
import {
  type Direction,
  heldDirection,
  isDirection,
  panDistance,
} from "./navigation";

interface Controls {
  canPan: boolean;
  maximum: number;
  onIntent: () => void;
  onPan: (delta: Point) => void;
  onZoom: (factor: number) => void;
  onSpatial: (direction: Direction) => void;
  onConnection: (direction: Direction) => void;
  onAccept: () => void;
  onToggle: () => void;
  onEscape: () => void;
}

/** One viewer-scoped held-key loop; native repeats do not drive pan distance. */
export function useMapKeyboard(
  ref: RefObject<HTMLDivElement | null>,
  controls: Controls,
) {
  const keys = useRef(new Set<string>());
  const frame = useRef<number | null>(null);
  const last = useRef(0);
  const elapsed = useRef(0);
  const stop = useCallback(() => {
    keys.current.clear();
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    elapsed.current = 0;
  }, []);
  const eligible = (target: EventTarget | null) =>
    target instanceof Element &&
    !!ref.current?.contains(target) &&
    (target === ref.current || !!target.closest("[data-node]"));
  const tick = useEffectEvent((now: number) => {
    if (!controls.canPan || !eligible(document.activeElement)) {
      stop();
      return;
    }
    const direction = heldDirection(keys.current);
    const seconds = Math.min(0.05, Math.max(0, (now - last.current) / 1000));
    last.current = now;
    if (direction.x || direction.y) {
      const distance = panDistance(elapsed.current, seconds, controls.maximum);
      elapsed.current += seconds;
      controls.onPan({
        x: -direction.x * distance,
        y: -direction.y * distance,
      });
    }
    frame.current = requestAnimationFrame(tick);
  });
  const down = useEffectEvent((event: KeyboardEvent) => {
    if (!eligible(event.target)) return;
    if (event.isComposing || event.metaKey || event.altKey) {
      stop();
      return;
    }
    if (event.ctrlKey && ["=", "+", "-"].includes(event.key)) {
      event.preventDefault();
      controls.onIntent();
      stop();
      controls.onZoom(event.key === "-" ? 1 / 1.2 : 1.2);
      return;
    }
    if (["Control", "Shift", "Alt", "Meta", "Tab"].includes(event.key)) stop();
    if (isDirection(event.key)) {
      event.preventDefault();
      controls.onIntent();
      if (event.ctrlKey || event.shiftKey) {
        stop();
        if (event.ctrlKey && !event.shiftKey) controls.onSpatial(event.key);
        else if (event.shiftKey && !event.ctrlKey && !event.repeat)
          controls.onConnection(event.key);
        return;
      }
      if (!controls.canPan || event.repeat || keys.current.has(event.key))
        return;
      const previous = heldDirection(keys.current),
        wasEmpty = keys.current.size === 0;
      keys.current.add(event.key);
      const direction = heldDirection(keys.current);
      if (previous.x !== direction.x || previous.y !== direction.y)
        elapsed.current = 0;
      if (wasEmpty)
        controls.onPan({ x: -direction.x * 8, y: -direction.y * 8 });
      if (frame.current === null) {
        last.current = performance.now();
        frame.current = requestAnimationFrame(tick);
      }
    } else if (
      event.key === " " ||
      event.key === "Enter" ||
      event.key === "Escape"
    ) {
      event.preventDefault();
      controls.onIntent();
      stop();
      if (event.repeat || (event.ctrlKey && event.shiftKey)) return;
      if (event.key === " ") controls.onAccept();
      else if (event.key === "Enter") controls.onToggle();
      else controls.onEscape();
    }
  });
  const up = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.key === " " &&
      eligible(event.target) &&
      !event.isComposing &&
      !event.metaKey &&
      !event.altKey
    )
      event.preventDefault();
    if (!keys.current.has(event.key)) return;
    const previous = heldDirection(keys.current);
    keys.current.delete(event.key);
    const direction = heldDirection(keys.current);
    if (direction.x !== previous.x || direction.y !== previous.y)
      elapsed.current = 0;
    if (!keys.current.size) stop();
  });
  const blur = useEffectEvent((event: FocusEvent) => {
    if (!eligible(event.relatedTarget)) stop();
  });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const hidden = () => {
      if (document.hidden) stop();
    };
    element.addEventListener("keydown", down);
    element.addEventListener("keyup", up);
    element.addEventListener("focusout", blur);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      stop();
      element.removeEventListener("keydown", down);
      element.removeEventListener("keyup", up);
      element.removeEventListener("focusout", blur);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [ref, stop]);
  return { stop };
}
