import Markdown from "react-markdown";
import { label } from "./graph";
import type { ViewerSidebarContext } from "./Viewer";

export default function ViewerInspector({
  graph,
  active,
  onFocus,
  onFragment,
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
        </div>
      </details>
      {(["outgoing", "incoming"] as const).map((direction) => {
        const connections = graph.edges.filter((edge) =>
          direction === "outgoing"
            ? edge.from === active?.key
            : edge.to === active?.key,
        );
        return (
          <details className="sidebar-section outgoing" open key={direction}>
            <summary>
              {direction === "outgoing"
                ? "Outgoing connections"
                : "Incoming connections"}
            </summary>
            {connections.map((edge) => {
              const key = direction === "outgoing" ? edge.to : edge.from;
              const node = graph.nodes.find(
                (candidate) => candidate.key === key,
              );
              return (
                node && (
                  <button
                    type="button"
                    key={edge.key}
                    onClick={() => onFocus(key)}
                  >
                    {label(node)} · {edge.kind}
                  </button>
                )
              );
            })}
            {!connections.length && <p>No {direction} connections.</p>}
          </details>
        );
      })}
    </aside>
  );
}
