import { thoughtAnchors } from "@lensmap/document";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  type GraphNode,
  Viewer,
  type ViewerState,
} from "../../../web/src/embed";
import {
  address,
  type MapEntry,
  type MapLoader,
  navigationId,
  thoughtURL,
} from "../../../web/src/map-navigation";
import {
  NavigationNotice,
  useMapNavigation,
} from "../../../web/src/use-map-navigation";
import type { heroView } from "../hero";

export default function MapSession({
  initial,
  base,
}: {
  initial: ReturnType<typeof heroView>;
  base: string;
}) {
  const [homeUri] = useState(
    () => new URL("hero.lensmap", new URL(base, location.href)).href,
  );
  const navigation = useMapNavigation({
    uri: homeUri,
    graph: initial.graph,
    attachment: "site:home",
    view: initial.state,
  });
  const entry = navigation.current;
  const home = entry.uri === homeUri;
  const container = useRef<HTMLDivElement>(null);
  const transferFocus = useRef(false);
  const maps = useRef(new Map<string, MapEntry>());
  const aliases = useRef(new Map<string, string>());
  const visits = useRef(new Map<string, { index: number; entry: MapEntry }>());
  const [, selectionChanged] = useState(0);
  const [openingError, setOpeningError] = useState("");
  maps.current.set(entry.uri, entry);

  const loader: MapLoader = async (uri, signal) => {
    const canonical = aliases.current.get(uri) ?? uri;
    const saved = maps.current.get(canonical);
    if (saved) return saved;
    if (!/^https?:/.test(canonical))
      throw Error("This website loads HTTP(S) maps only.");
    const response = await fetch(canonical, { signal, credentials: "omit" });
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
    const { parseSource } = await import("../../../web/src/document/parse");
    const parsed = parseSource(source);
    if (!parsed.ok) throw Error(parsed.error);
    signal.throwIfAborted();
    aliases.current.set(uri, resolved);
    return {
      uri: resolved,
      graph: parsed.graph,
      source,
      attachment: navigationId(),
    };
  };
  const route = () => {
    const current = navigation.current;
    const anchor = current.target
      ? thoughtAnchors(current.graph.nodes).get(current.target)
      : undefined;
    return thoughtURL(
      new URL(base, location.href).href,
      current.uri === homeUri ? "" : current.uri,
      anchor ?? "",
    );
  };
  const remember = (replace: boolean) => {
    const existing = replace ? history.state?.lensmapSiteVisit : undefined;
    const id =
      existing && visits.current.has(existing) ? existing : navigationId();
    visits.current.set(id, {
      index: navigation.index,
      entry: navigation.current,
    });
    return { ...history.state, lensmapSiteVisit: id };
  };
  const go = async (
    raw: string,
    restore?: number | MapEntry,
    fromBrowser = false,
    bootstrap = false,
  ) => {
    const focused = document.activeElement;
    transferFocus.current =
      !!focused &&
      !!container.current?.contains(focused) &&
      !!focused.closest(".map, .hero-action");
    const oldIndex = navigation.index;
    if (await navigation.go(raw, loader, restore)) {
      setOpeningError("");
      const replace =
        bootstrap || restore !== undefined || oldIndex === navigation.index;
      history[replace ? "replaceState" : "pushState"](
        remember(replace),
        "",
        fromBrowser ? location.href : route(),
      );
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: One session listener reads the stable mutable navigation/cache objects.
  useEffect(() => {
    history.replaceState(remember(true), "", location.href);
    const requested = new URL(location.href).searchParams.get("map");
    const raw = location.hash
      ? (requested ? requested.split("#", 1)[0] : homeUri) + location.hash
      : requested;
    if (raw) void go(raw, undefined, false, true);
    const pop = (event: PopStateEvent) => {
      const visit = visits.current.get(event.state?.lensmapSiteVisit);
      if (visit) {
        const restore =
          navigation.entries[visit.index] === visit.entry
            ? visit.index
            : visit.entry;
        void go(visit.entry.uri, restore, true);
      }
    };
    const hash = () => {
      void go(location.hash || "#");
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("hashchange", hash);
    return () => {
      navigation.cancel();
      window.removeEventListener("popstate", pop);
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: serial identifies committed map mounts; do not steal external focus after a delayed load.
  useLayoutEffect(() => {
    if (transferFocus.current && document.activeElement === document.body) {
      container.current
        ?.querySelector<HTMLElement>('[role="application"]')
        ?.focus({ preventScroll: true });
    }
    transferFocus.current = false;
  }, [navigation.serial]);
  const onStateChange = useCallback(
    (state: ViewerState) => {
      const changed = entry.view?.selected !== state.selected;
      entry.view = state;
      if (changed) selectionChanged((value) => value + 1);
    },
    [entry],
  );

  const portalLink = (node: GraphNode) => {
    if (!node.destination) return;
    const target = address(node.destination.url, entry.uri);
    if (node.destination.kind === "map_link") {
      return {
        href: thoughtURL(
          new URL(base, location.href).href,
          target.uri === homeUri ? "" : target.uri,
          target.fragment,
        ),
        external: false,
      };
    }
    const url = new URL(target.uri);
    if (!["http:", "https:"].includes(url.protocol))
      throw Error("This website can open HTTP(S) resources only.");
    url.hash = target.fragment ? encodeURIComponent(target.fragment) : "";
    const external =
      url.origin !== location.origin || !url.pathname.startsWith(base);
    return {
      href: external ? url.href : url.pathname + url.search + url.hash,
      external,
    };
  };
  const activate = (node: GraphNode) => {
    if (!node.destination) return;
    if (node.destination.kind === "map_link") {
      void go(node.destination.url);
      return;
    }
    try {
      const destination = portalLink(node);
      if (!destination) return;
      setOpeningError("");
      if (destination.external)
        window.open(destination.href, "_blank", "noopener,noreferrer");
      else location.assign(destination.href);
    } catch (error) {
      setOpeningError(
        error instanceof Error ? error.message : "Opening failed.",
      );
    }
  };
  const active = entry.graph.nodes.find(
    (node) =>
      node.key ===
      (entry.view?.selected ?? entry.target ?? entry.graph.nodes[0]?.key),
  );
  let destination: ReturnType<typeof portalLink>;
  let invalidDestination = "";
  try {
    if (active) destination = portalLink(active);
  } catch (error) {
    invalidDestination =
      error instanceof Error ? error.message : "Invalid destination.";
  }

  const action = (
    <div className="hero-action" aria-live="polite">
      {destination && active ? (
        <a
          href={destination.href}
          target={destination.external ? "_blank" : undefined}
          rel={destination.external ? "noopener noreferrer" : undefined}
          onClick={(event) => {
            if (
              active.destination?.kind === "map_link" &&
              event.button === 0 &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.shiftKey &&
              !event.altKey
            ) {
              event.preventDefault();
              activate(active);
            }
          }}
        >
          Open {active.title}{" "}
          <span aria-hidden="true">
            {active.destination?.kind === "map_link" ? "→" : "↗"}
          </span>
        </a>
      ) : (
        <p>Select a thought. Follow a connection.</p>
      )}
    </div>
  );
  return (
    <div
      ref={container}
      className={`hero-interaction ${home ? "home-map" : "example-map"}`}
      data-map-uri={entry.uri}
    >
      {navigation.entries.length > 1 && (
        <nav className="site-map-navigation" aria-label="Map navigation">
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
          <span>{home ? "Lensmap" : entry.graph.nodes[0]?.title}</span>
          {!home && <a href={`${base}docs/examples/`}>Examples guide</a>}
        </nav>
      )}
      <NavigationNotice
        navigation={navigation}
        openAnyway={() => {
          if (navigation.fallback) void go(navigation.fallback);
        }}
      />
      {(openingError || invalidDestination) && (
        <p role="alert">{openingError || invalidDestination}</p>
      )}
      {!home && action}
      <div className="hero-canvas">
        <Viewer
          key={navigation.serial}
          graph={entry.graph}
          embedded
          showInspector={!home}
          initialState={entry.view}
          initialTarget={entry.target}
          initialOverview={entry.overview}
          thoughtLink={(anchor) =>
            thoughtURL(
              new URL(base, location.href).href,
              home ? "" : entry.uri,
              anchor,
            )
          }
          onStateChange={onStateChange}
          onActivatePortal={activate}
        />
      </div>
      {home && action}
    </div>
  );
}
