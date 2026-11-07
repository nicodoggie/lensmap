import { thoughtAnchors } from "@lensmap/document";
import Markdown from "react-markdown";
import type { ViewerSidebarContext } from "./Viewer";
import ViewerConnections from "./ViewerConnections";

export default function ViewerInspector({
  graph,
  thoughtHref,
  active,
  onFocus,
  onFragment,
  onActivatePortal,
  onRevealSource,
}: ViewerSidebarContext & {
  onRevealSource?: (key: string) => void;
}) {
  return (
    <aside className="notes" id="lensmap-sidebar" aria-label="Sidebar">
      <details className="sidebar-section" open>
        <summary>Selected thought</summary>
        <div className="note-content">
          {active ? (
            <Markdown
              components={{
                h1: ({ children }) => <h2>{children}</h2>,
                a: ({ href, children }) => (
                  <a
                    href={href}
                    onClick={(event) => {
                      if (href?.startsWith("#")) {
                        event.preventDefault();
                        onFragment(href.slice(1));
                      }
                    }}
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {active.markdown ||
                (active.unresolved ? "# Unresolved thought" : active.title)}
            </Markdown>
          ) : (
            <p>No thought selected.</p>
          )}
          {active && onRevealSource && (
            <button type="button" onClick={() => onRevealSource(active.key)}>
              Reveal source
            </button>
          )}
          {active && (
            <a
              href={
                thoughtHref ??
                `#${encodeURIComponent(thoughtAnchors(graph.nodes).get(active.key) ?? active.key)}`
              }
              onClick={(event) => {
                event.preventDefault();
                onFragment(
                  encodeURIComponent(
                    thoughtAnchors(graph.nodes).get(active.key) ?? active.key,
                  ),
                );
              }}
            >
              Link to this thought
            </a>
          )}
          {active?.destination && (
            <div className="portal-actions">
              <p>{active.destination.url}</p>
              <button
                type="button"
                onClick={() => onActivatePortal?.(active)}
                disabled={!onActivatePortal}
              >
                Open{" "}
                {active.destination.kind === "map_link"
                  ? "destination map"
                  : "external link"}
              </button>
            </div>
          )}
        </div>
      </details>
      <ViewerConnections graph={graph} active={active} onFocus={onFocus} />
    </aside>
  );
}
