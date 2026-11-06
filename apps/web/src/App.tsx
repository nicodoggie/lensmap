import { thoughtAnchors } from "@lensmap/document";
import { useEffect, useRef, useState } from "react";
import { parseSource } from "./document/parse";
import {
  address,
  type MapEntry,
  type MapLoader,
  thoughtURL,
} from "./map-navigation";
import Sidebar from "./Sidebar";
import sampleSource from "./sample.yaml?raw";
import { NavigationNotice, useMapNavigation } from "./use-map-navigation";
import Viewer from "./Viewer";

const initialDocument = parseSource(sampleSource);
if (!initialDocument.ok) throw Error(initialDocument.error);
const sampleGraph = initialDocument.graph;
export default function App() {
  const navigation = useMapNavigation({
    uri: "",
    graph: sampleGraph,
    attachment: "draft:0",
    source: sampleSource,
    draft: sampleSource,
  });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const entry = navigation.current;
  const [, refresh] = useState(0);
  const maps = useRef(new Map<string, typeof entry>());
  const aliases = useRef(new Map<string, string>());
  const visits = useRef(new Map<string, { index: number; entry: MapEntry }>());
  maps.current.set(entry.uri, entry);
  const loader: MapLoader = async (uri, signal) => {
    const canonical = aliases.current.get(uri) ?? uri;
    const saved = maps.current.get(canonical);
    // In-session applied playground edits remain current; history is not source undo.
    if (saved) return saved;
    if (!/^https?:/.test(canonical))
      throw Error("Local maps are not attached in this standalone viewer.");
    const response = await fetch(canonical, { signal });
    if (!response.ok) throw Error(`Map loading failed (${response.status}).`);
    const resolved = address(response.url).uri;
    const retained = maps.current.get(resolved);
    if (retained) {
      await response.body?.cancel();
      signal.throwIfAborted();
      aliases.current.set(uri, resolved);
      return retained;
    }
    const source = await response.text();
    const parsed = parseSource(source);
    if (!parsed.ok) throw Error(parsed.error);
    signal.throwIfAborted();
    aliases.current.set(uri, resolved);
    return {
      uri: resolved,
      graph: parsed.graph,
      source,
      draft: source,
      attachment: crypto.randomUUID(),
    };
  };
  const route = () => {
    const url = new URL(location.href);
    if (navigation.current.uri) {
      const current = navigation.current;
      const anchor = current.target
        ? thoughtAnchors(current.graph.nodes).get(current.target)
        : undefined;
      url.searchParams.set(
        "map",
        current.uri + (anchor ? `#${encodeURIComponent(anchor)}` : ""),
      );
    } else url.searchParams.delete("map");
    url.hash = "";
    return url;
  };
  const rememberVisit = (replace = false) => {
    const existing = replace
      ? (history.state as { lensmapVisit?: string } | null)?.lensmapVisit
      : undefined;
    const lensmapVisit =
      existing && visits.current.has(existing) ? existing : crypto.randomUUID();
    visits.current.set(lensmapVisit, {
      index: navigation.index,
      entry: navigation.current,
    });
    return { lensmapVisit };
  };
  const go = async (
    raw: string,
    restore?: number | MapEntry,
    fromBrowser = false,
  ) => {
    const oldIndex = navigation.index;
    const committed = await navigation.go(
      raw,
      loader,
      restore,
      import.meta.env.DEV ? location.origin : undefined,
    );
    if (committed) {
      setError("");
      setStatus("");
      const method =
        restore !== undefined || navigation.index === oldIndex
          ? "replaceState"
          : "pushState";
      history[method](
        rememberVisit(method === "replaceState"),
        "",
        fromBrowser ? location.href : route(),
      );
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: One session listener reads the stable mutable navigation object.
  useEffect(() => {
    history.replaceState(rememberVisit(true), "", location.href);
    const requested = new URL(location.href).searchParams.get("map");
    if (requested || location.hash) {
      const raw = location.hash
        ? (requested ? requested.split("#", 1)[0] : "") + location.hash
        : requested;
      if (raw) void go(raw, 0);
    }
    const pop = (event: PopStateEvent) => {
      const id = (event.state as { lensmapVisit?: string } | null)
        ?.lensmapVisit;
      const visit = id ? visits.current.get(id) : undefined;
      if (visit) {
        // Viewer Back can take a different branch from browser history. Retain
        // the actual visit, not an array index that a later map can reuse.
        const restore =
          navigation.entries[visit.index] === visit.entry
            ? visit.index
            : visit.entry;
        void go(visit.entry.uri, restore, true);
      }
    };
    window.addEventListener("popstate", pop);
    const hash = () => {
      void go(location.hash || "#");
    };
    window.addEventListener("hashchange", hash);
    return () => {
      navigation.cancel();
      window.removeEventListener("popstate", pop);
      window.removeEventListener("hashchange", hash);
    };
    // Session object and initial route are intentionally stable.
  }, []);
  return (
    <>
      <NavigationNotice
        navigation={navigation}
        openAnyway={() => {
          if (navigation.fallback) void go(navigation.fallback);
        }}
      />
      <Viewer
        key={navigation.serial}
        graph={entry.graph}
        navigationControls={
          <nav className="segmented" aria-label="Map navigation">
            <button
              type="button"
              disabled={navigation.index === 0}
              onClick={() => {
                const index = navigation.index - 1;
                void go(navigation.entries[index].uri, index);
              }}
            >
              Back
            </button>
            <button
              type="button"
              disabled={navigation.index >= navigation.entries.length - 1}
              onClick={() => {
                const index = navigation.index + 1;
                void go(navigation.entries[index].uri, index);
              }}
            >
              Forward
            </button>
          </nav>
        }
        thoughtLink={(anchor) => thoughtURL(location.href, entry.uri, anchor)}
        updateMode="replace"
        initialState={entry.view}
        initialTarget={entry.target}
        initialOverview={entry.overview}
        onStateChange={(state) => {
          entry.view = state;
        }}
        onActivatePortal={(node) => {
          if (!node.destination) return;
          if (node.destination.kind === "map_link") {
            void go(node.destination.url);
            return;
          }
          try {
            const resolved = address(node.destination.url, entry.uri);
            if (!/^https?:/.test(resolved.uri))
              throw Error("Standalone external opening supports HTTP(S) only.");
            window.open(
              resolved.uri +
                (resolved.fragment
                  ? `#${encodeURIComponent(resolved.fragment)}`
                  : ""),
              "_blank",
              "noopener",
            );
          } catch (e) {
            setError(e instanceof Error ? e.message : "Opening failed.");
          }
        }}
        renderSidebar={(context) => (
          <Sidebar
            {...context}
            source={entry.draft ?? ""}
            applied={entry.source ?? ""}
            error={error}
            status={status}
            onSourceChange={(value) => {
              entry.draft = value;
              refresh((n) => n + 1);
            }}
            onApply={() => {
              navigation.cancel();
              navigation.error = "";
              const result = parseSource(entry.draft ?? "");
              if (!result.ok) {
                setError(result.error);
                setStatus("");
                return;
              }
              entry.graph = result.graph;
              entry.source = entry.draft;
              entry.attachment = crypto.randomUUID();
              setError("");
              setStatus(
                `Applied ${result.graph.nodes.length} thoughts and ${result.graph.edges.length} connections.`,
              );
              refresh((n) => n + 1);
            }}
            onLoadSample={() => {
              entry.draft = sampleSource;
              refresh((n) => n + 1);
              setError("");
              setStatus(
                "Sample loaded into the draft. Apply YAML to change the map.",
              );
            }}
          />
        )}
      />
    </>
  );
}
