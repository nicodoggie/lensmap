import { resolveThoughtAnchor } from "@lensmap/document";
import type { GraphData } from "./graph";
import type { ViewerState } from "./Viewer";

/** Opaque visit/attachment identity, including across reloads and on HTTP hosts. */
export function navigationId(): string {
  // Unlike randomUUID, getRandomValues is available outside secure contexts.
  return crypto.getRandomValues(new Uint32Array(4)).join("-");
}

/** A public thought link includes its source resource, never a bootstrap token. */
export function thoughtURL(
  viewer: string,
  resource: string,
  anchor: string,
): string {
  const url = new URL(viewer);
  if (resource) url.searchParams.set("map", resource);
  else url.searchParams.delete("map");
  url.hash = encodeURIComponent(anchor);
  return url.href;
}

export function address(
  raw: string,
  base?: string,
): { uri: string; fragment: string } {
  if (
    !raw.trim() ||
    Array.from(raw).some(
      (c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127,
    )
  )
    throw Error("Invalid destination address.");
  let url: URL;
  try {
    url = new URL(raw, base || undefined);
  } catch {
    throw Error(
      "Destination needs a source map address; this draft has no source base.",
    );
  }
  if (
    !["http:", "https:", "file:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw Error("Unsupported or unsafe destination address.");
  let fragment: string;
  try {
    decodeURI(url.pathname);
    fragment = decodeURIComponent(url.hash.slice(1));
  } catch {
    throw Error("Invalid destination fragment encoding.");
  }
  url.hash = "";
  return { uri: url.href, fragment };
}
export interface MapEntry {
  uri: string;
  graph: GraphData;
  attachment: string;
  source?: string;
  draft?: string;
  view?: ViewerState;
  target?: string;
  overview?: boolean;
}
export type MapLoader = (uri: string, signal: AbortSignal) => Promise<MapEntry>;
export function restoreView(
  old: MapEntry,
  fresh: MapEntry,
  state?: ViewerState,
): ViewerState | undefined {
  if (!state) return;
  const selected = old.graph.nodes.find((n) => n.key === state.selected);
  const key =
    selected?.id !== undefined
      ? fresh.graph.nodes.find((n) => n.id === selected.id)?.key
      : old.attachment === fresh.attachment &&
          fresh.graph.nodes.some((n) => n.key === state.selected)
        ? state.selected
        : undefined;
  if (!key) return;
  return { ...state, selected: key };
}
/** Session state never restores source bytes into an authoritative buffer. */
export class Navigation {
  entries: MapEntry[];
  index = 0;
  serial = 0;
  error = "";
  fallback?: string;
  private request = 0;
  private controller?: AbortController;
  constructor(
    initial: MapEntry,
    private changed: () => void,
  ) {
    this.entries = [initial];
  }
  get current() {
    return this.entries[this.index];
  }
  cancel() {
    this.request++;
    this.controller?.abort();
    this.fallback = undefined;
  }
  private async load(uri: string, loader: MapLoader) {
    this.controller?.abort();
    this.controller = new AbortController();
    return loader(uri, this.controller.signal);
  }
  async go(
    raw: string,
    loader: MapLoader,
    history?: number | MapEntry,
    rootBase?: string,
  ) {
    const ticket = ++this.request;
    let committed = false;
    this.error = "";
    this.fallback = undefined;
    try {
      const historyIndex = typeof history === "number" ? history : undefined;
      const previous =
        typeof history === "object"
          ? history
          : historyIndex !== undefined
            ? this.entries[historyIndex]
            : undefined;
      // A host may opt a locationless draft into root paths, never bare paths
      // or authority-relative URLs. An actual source location always wins.
      const base =
        this.current.uri ||
        (raw.startsWith("/") && !/^[/\\]{2}/.test(raw) ? rootBase : undefined);
      const { uri, fragment } = raw.startsWith("#")
        ? { uri: this.current.uri, fragment: decodeURIComponent(raw.slice(1)) }
        : history !== undefined && !raw
          ? { uri: "", fragment: "" }
          : address(raw, base);
      const loaded = await this.load(uri, loader);
      if (ticket !== this.request) return false;
      const target = fragment
        ? resolveThoughtAnchor(loaded.graph.nodes, fragment)
        : undefined;
      if (fragment && !target) {
        this.fallback = loaded.uri || "#";
        throw Error(`Thought target “${fragment}” was not found.`);
      }
      let next: MapEntry = {
        ...loaded,
        view: undefined,
        target,
        overview: !fragment,
      };
      if (previous) {
        const sameResource = previous.uri === loaded.uri;
        const view = sameResource
          ? restoreView(previous, loaded, previous.view)
          : undefined;
        if (sameResource && previous.view && !view)
          this.error = "Previous view target is removed or unavailable.";
        next = {
          ...next,
          draft: loaded.draft ?? (sameResource ? previous.draft : undefined),
          view,
        };
      }
      if (historyIndex !== undefined) {
        this.entries[historyIndex] = next;
        this.index = historyIndex;
      } else if (loaded.uri === this.current.uri) {
        this.entries[this.index] = { ...next, draft: this.current.draft };
      } else {
        this.entries = this.entries.slice(0, this.index + 1);
        this.entries.push(next);
        this.index++;
      }
      this.serial++;
      committed = true;
    } catch (error) {
      if (ticket === this.request)
        this.error =
          error instanceof Error ? error.message : "Navigation failed.";
    }
    if (ticket === this.request) this.changed();
    return ticket === this.request && committed;
  }
  async openAnyway(loader: MapLoader) {
    if (this.fallback) await this.go(this.fallback, loader);
  }
}
