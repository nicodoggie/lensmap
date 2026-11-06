import Markdown from "react-markdown";
import { type GraphData, type GraphNode, label } from "./graph";

interface Props {
  graph: GraphData;
  active?: GraphNode;
  onFocus: (key: string) => void;
  onFragment: (id: string) => void;
  source: string;
  applied: string;
  error: string;
  status: string;
  onSourceChange: (source: string) => void;
  onApply: () => void;
  onLoadSample: () => void;
}

export default function Sidebar({
  graph,
  active,
  onFocus,
  onFragment,
  source,
  applied,
  error,
  status,
  onSourceChange,
  onApply,
  onLoadSample,
}: Props) {
  const outgoing = graph.edges.filter((edge) => edge.from === active?.key);

  return (
    <aside className="notes" id="lensmap-sidebar" aria-label="Sidebar">
      <div className="note-eyebrow">
        <span>THOUGHTS & SOURCE</span>
        <span>v1 / incomplete</span>
      </div>
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
                (active.unresolved
                  ? "# Unresolved thought\n\nThis thought has not been named yet."
                  : active.title)}
            </Markdown>
          ) : (
            <p>No thought selected.</p>
          )}
        </div>
      </details>
      <details className="sidebar-section outgoing" open>
        <summary>Explicit connections</summary>
        {outgoing.map((edge) => {
          const target = graph.nodes.find((node) => node.key === edge.to);
          return (
            target && (
              <button
                type="button"
                key={edge.key}
                onClick={() => onFocus(edge.to)}
              >
                <span>
                  {edge.kind === "cross" ? "┄➤" : "↳"} {label(target)}
                </span>
                <span aria-hidden="true">↗</span>
              </button>
            )
          );
        })}
        {!outgoing.length && <p>No outgoing connections yet.</p>}
      </details>
      <details className="sidebar-section playground">
        <summary>YAML playground</summary>
        <p className="editor-help" id="source-help">
          Experimental <code>version: v1</code>. This is an incomplete schema,
          not a frozen format. Write thoughts first; positions and IDs are
          optional.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onApply();
          }}
        >
          <label className="source-label" htmlFor="yaml-source">
            YAML source
          </label>
          <textarea
            id="yaml-source"
            aria-describedby="source-help source-lifetime"
            spellCheck={false}
            value={source}
            onChange={(event) => onSourceChange(event.target.value)}
          />
          <div className="editor-actions">
            <button type="submit">Apply YAML</button>
            <button type="button" onClick={onLoadSample}>
              Load sample
            </button>
          </div>
          <p className="editor-state">
            {source === applied
              ? "Draft matches the map."
              : "Unapplied changes — the map still shows the last valid document."}
          </p>
          {error && (
            <pre className="source-error" role="alert">
              {error}
            </pre>
          )}
          <p className="editor-state" role="status">
            {status}
          </p>
        </form>
        <p className="editor-help" id="source-lifetime">
          Drafts stay here while you navigate or collapse sections. Reloading
          the page discards them; saving and editor language tooling are not
          implemented yet.
        </p>
      </details>
    </aside>
  );
}
