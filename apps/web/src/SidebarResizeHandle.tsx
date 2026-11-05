import { useEffect, useRef, useState } from "react";

interface Props {
  width: number;
  onResize: (width: number) => void;
}

export default function SidebarResizeHandle({ width, onResize }: Props) {
  const handle = useRef<HTMLHRElement>(null);
  const currentWidth = useRef(width);
  currentWidth.current = width;
  const drag = useRef<{ id: number; x: number; width: number } | null>(null);
  const [maximum, setMaximum] = useState(720);
  const minimum = 240;

  useEffect(() => {
    const parent = handle.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(([entry]) => {
      if (window.matchMedia("(max-width: 760px)").matches) return;
      const max = Math.max(
        minimum,
        Math.min(720, entry.contentRect.width - 320),
      );
      setMaximum(max);
      if (currentWidth.current > max) onResize(max);
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [onResize]);

  function resize(next: number) {
    onResize(Math.max(minimum, Math.min(maximum, next)));
  }

  return (
    <hr
      ref={handle}
      className="sidebar-resizer"
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      aria-controls="lensmap-sidebar"
      aria-valuemin={minimum}
      aria-valuemax={maximum}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, x: event.clientX, width };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (start?.id === event.pointerId)
          resize(start.width + start.x - event.clientX);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onKeyDown={(event) => {
        const next = {
          ArrowLeft: width + 24,
          ArrowRight: width - 24,
          Home: minimum,
          End: maximum,
        }[event.key];
        if (next !== undefined) {
          event.preventDefault();
          resize(next);
        }
      }}
    />
  );
}
