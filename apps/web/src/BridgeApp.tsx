import type { DocumentSnapshot, SemanticGraph } from "@lensmap/document";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { type BridgeEvent, connectBridge, revealSource } from "./bridge-client";
import type { GraphData } from "./graph";
import { layoutSemanticGraph } from "./semantic-layout";
import Viewer from "./Viewer";
import "./bridge.css";

interface LayoutCache {
  revision: number | null;
  semantic: SemanticGraph;
  layout: GraphData;
}
const name = (uri: string) => {
  try {
    return decodeURIComponent(new URL(uri).pathname.split("/").at(-1) ?? uri);
  } catch {
    return uri;
  }
};

export default function BridgeApp() {
  const [documents, setDocuments] = useState<DocumentSnapshot[]>([]);
  const snapshots = useRef(new Map<string, DocumentSnapshot>());
  const layouts = useRef(new Map<string, LayoutCache>());
  const [activeUri, setActiveUri] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [actionError, setActionError] = useState("");
  const [follow, setFollow] = useState(false);
  const [inspector, setInspector] = useState(false);
  const lastCaret = useRef<{ uri: string; key: string | null } | undefined>(
    undefined,
  );
  const [focusRequest, setFocusRequest] = useState<{
    key: string;
    sequence: number;
  }>();
  const requestSequence = useRef(0);
  const requestFocus = (uri: string, key: string) => {
    setActiveUri(uri);
    setFocusRequest({ key, sequence: ++requestSequence.current });
  };
  const receive = useEffectEvent((event: BridgeEvent) => {
    if (event.type === "session") {
      snapshots.current = new Map(
        event.documents.map((snapshot) => [snapshot.uri, snapshot]),
      );
      // Revisions and thought keys are attachment-local. A reopened URI may
      // start at the same revision with entirely different source.
      for (const uri of layouts.current.keys()) {
        if (!snapshots.current.has(uri)) layouts.current.delete(uri);
      }
      if (lastCaret.current && !snapshots.current.has(lastCaret.current.uri))
        lastCaret.current = undefined;
      if (activeUri && !snapshots.current.has(activeUri))
        setFocusRequest(undefined);
      setDocuments(event.documents);
      setActiveUri((current) =>
        current && snapshots.current.has(current)
          ? current
          : (event.activeUri ?? event.documents[0]?.uri ?? null),
      );
    } else if (event.type === "snapshot") {
      snapshots.current.set(event.snapshot.uri, event.snapshot);
      setDocuments([...snapshots.current.values()]);
      setActiveUri((current) => current ?? event.snapshot.uri);
    } else if (event.type === "focus") {
      if (
        snapshots.current
          .get(event.uri)
          ?.graph?.nodes.some((node) => node.key === event.key)
      )
        requestFocus(event.uri, event.key);
    } else if (event.type === "caret") {
      const snapshot = snapshots.current.get(event.uri);
      if (
        !snapshot ||
        snapshot.revision !== event.revision ||
        !snapshot.valid ||
        snapshot.pending
      ) {
        lastCaret.current = undefined;
        return;
      }
      const changed =
        lastCaret.current?.uri !== event.uri ||
        lastCaret.current?.key !== event.key;
      lastCaret.current = { uri: event.uri, key: event.key };
      if (follow && changed && event.key) requestFocus(event.uri, event.key);
    }
  });
  useEffect(
    () =>
      connectBridge(receive, (live, error) => {
        setConnected(live);
        setConnectionError(error ?? "");
      }),
    [],
  );
  const document = documents.find((snapshot) => snapshot.uri === activeUri);
  const graph = useMemo(() => {
    if (!document?.graph) return null;
    const previous = layouts.current.get(document.uri);
    if (
      previous?.revision === document.graphRevision &&
      JSON.stringify(previous.semantic) === JSON.stringify(document.graph)
    )
      return previous.layout;
    const layout = layoutSemanticGraph(document.graph, previous);
    layouts.current.set(document.uri, {
      revision: document.graphRevision,
      semantic: document.graph,
      layout,
    });
    return layout;
  }, [document]);
  const status = !connected
    ? "Disconnected"
    : !document
      ? "Waiting for a .lensmap document"
      : document.pending
        ? `Analyzing r${document.revision} · showing r${document.graphRevision ?? "—"}`
        : document.valid
          ? `Live · r${document.revision}`
          : `Source r${document.revision} invalid · showing r${document.graphRevision ?? "—"} · stale`;
  return (
    <div className="bridge-shell">
      <header className="bridge-bar">
        <strong>◎ Lensmap</strong>
        <select
          aria-label="Document"
          value={activeUri ?? ""}
          onChange={(event) => {
            setActiveUri(event.target.value);
            setFocusRequest(undefined);
            setActionError("");
          }}
        >
          {!documents.length && <option value="">No attached document</option>}
          {documents.map((snapshot) => (
            <option key={snapshot.uri} value={snapshot.uri}>
              {name(snapshot.uri)}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={follow}
            onChange={(event) => {
              setFollow(event.target.checked);
              const caret = lastCaret.current;
              if (event.target.checked && caret?.key)
                requestFocus(caret.uri, caret.key);
            }}
          />
          Follow editor caret
        </label>
        <button
          type="button"
          aria-pressed={inspector}
          onClick={() => setInspector((shown) => !shown)}
        >
          Thought details
        </button>
        <span role="status" data-testid="bridge-status">
          {status}
        </span>
      </header>
      {(connectionError || actionError) && (
        <p className="bridge-notice">
          {actionError || connectionError} The last map is retained.
        </p>
      )}
      {document && !document.pending && document.diagnostics.length > 0 && (
        <div className="bridge-errors" role="alert">
          {document.diagnostics.map((error) => (
            <p
              key={`${error.range.start.line}:${error.range.start.character}:${error.message}`}
            >
              {error.message}
            </p>
          ))}
        </div>
      )}
      {graph && activeUri ? (
        <Viewer
          key={activeUri}
          graph={graph}
          updateMode="live"
          focusRequest={focusRequest}
          showInspector={inspector}
          onRevealSource={(key) => {
            setActionError("");
            void revealSource(activeUri, key).catch((error: unknown) =>
              setActionError(
                error instanceof Error
                  ? error.message
                  : "Source reveal failed.",
              ),
            );
          }}
        />
      ) : (
        <section className="bridge-empty">
          <h1>Open a .lensmap document in Zed</h1>
          <p>
            Unsaved buffer contents drive this preview. Use the Lensmap code
            actions to open or centre it.
          </p>
          <p>
            The format and integration are experimental. Source editing stays in
            your editor.
          </p>
        </section>
      )}
    </div>
  );
}
