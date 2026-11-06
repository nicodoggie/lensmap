import { describe, expect, it } from "vitest";
import type { GraphData } from "./graph";
import {
  address,
  type MapEntry,
  Navigation,
  restoreView,
} from "./map-navigation";
import type { ViewerState } from "./Viewer";

const graph: GraphData = {
  nodes: [
    {
      key: "one",
      id: "a",
      title: "A",
      markdown: "A",
      unresolved: false,
      x: 0,
      y: 0,
      branch: "blue",
    },
  ],
  edges: [],
};
const entry = (uri = "https://example.org/a", attachment = "a"): MapEntry => ({
  uri,
  graph,
  attachment,
});
const view: ViewerState = {
  selected: "one",
  camera: { x: 4, y: 8, zoom: 2 },
  strength: 1.7,
  overview: false,
  inNeighbourhood: true,
  neighbourhoodCamera: { x: 2, y: 9, zoom: 3 },
  neighbourhoodStrength: 2,
  returnOverview: true,
};
describe("map navigation", () => {
  it("resolves relative paths against source, preserving exact once-decoded fragments", () => {
    expect(address("../b#%2520", "https://example.org/maps/a")).toEqual({
      uri: "https://example.org/b",
      fragment: "%20",
    });
    expect(address("./b#%20A%20", "file:///notes/a")).toEqual({
      uri: "file:///notes/b",
      fragment: " A ",
    });
    expect(address("https://example.org/b#").fragment).toBe("");
  });
  it.each([
    "b",
    "javascript:alert(1)",
    "data:text/plain,hello",
    "https://u:p@example.org/a",
    "https://example.org/#%ZZ",
    "https://example.org/%ZZ",
    "https://example.org/\npath",
  ])("rejects unsafe, locationless or malformed address %s", (raw) => {
    expect(() => address(raw)).toThrow();
  });
  it("opts a locationless draft into root URLs without overriding a source base", async () => {
    const origin = "http://127.0.0.1:5173";
    const loaded: string[] = [];
    const loader = async (uri: string) => {
      loaded.push(uri);
      return entry(uri);
    };
    const n = new Navigation(entry(""), () => {});
    expect(await n.go("/quickstart.lensmap#a", loader)).toBe(false);
    expect(n.error).toContain("no source base");
    expect(loaded).toEqual([]);
    expect(await n.go("/quickstart.lensmap#a", loader, undefined, origin)).toBe(
      true,
    );
    expect(loaded).toEqual([`${origin}/quickstart.lensmap`]);
    expect(n.current.target).toBe("one");
    expect(n.current.overview).toBe(false);

    const hosted = new Navigation(
      entry("https://maps.example.org/notes/a"),
      () => {},
    );
    await hosted.go("/b", loader, undefined, origin);
    expect(hosted.current.uri).toBe("https://maps.example.org/b");
  });
  it.each([
    "./quickstart.lensmap",
    "//maps.example.org/a",
    "/\\maps.example.org/a",
    "/bad\npath",
    "/a#%ZZ",
  ])(
    "does not reinterpret unsupported development root address %s",
    async (raw) => {
      const n = new Navigation(entry(""), () => {});
      let calls = 0;
      const committed = await n.go(
        raw,
        async (uri) => {
          calls++;
          return entry(uri);
        },
        undefined,
        "http://127.0.0.1:5173",
      );
      expect(committed).toBe(false);
      expect(calls).toBe(0);
      expect(n.current.uri).toBe("");
      expect(n.error).not.toBe("");
    },
  );
  it("commits only the newest request even if the old loader ignores cancellation", async () => {
    let finish!: (value: MapEntry) => void;
    const n = new Navigation(entry(), () => {});
    const old = n.go(
      "https://example.org/old",
      () =>
        new Promise((r) => {
          finish = r;
        }),
    );
    await n.go("https://example.org/new", async (uri) => entry(uri));
    finish(entry("https://example.org/old"));
    await old;
    expect(n.current.uri).toBe("https://example.org/new");
    expect(n.entries).toHaveLength(2);
  });
  it("explicit cancellation suppresses late success and failure", async () => {
    let reject!: (error: Error) => void;
    const n = new Navigation(entry(), () => {});
    const pending = n.go(
      "https://example.org/next",
      () =>
        new Promise((_, r) => {
          reject = r;
        }),
    );
    n.cancel();
    reject(Error("late"));
    await pending;
    expect(n.index).toBe(0);
    expect(n.error).toBe("");
  });
  it("missing anchors retain the current view; fallback revalidates and opens Overview", async () => {
    const initial = { ...entry(), view };
    const n = new Navigation(initial, () => {});
    await n.go("https://example.org/b#lost", async (uri) => entry(uri));
    expect(n.current).toBe(initial);
    expect(n.entries).toHaveLength(1);
    await n.openAnyway(async () => {
      throw Error("not attached");
    });
    expect(n.error).toContain("not attached");
    expect(n.current).toBe(initial);
    await n.go("https://example.org/b#lost", async (uri) => entry(uri));
    await n.openAnyway(async (uri) => entry(uri));
    expect(n.current.overview).toBe(true);
    expect(n.current.target).toBeUndefined();
    expect(n.index).toBe(1);
  });
  it("exact fragments enter Lens and same-map targeting adds no cross-map step", async () => {
    const n = new Navigation(entry(), () => {});
    await n.go("https://example.org/a#a", async (uri) => entry(uri));
    expect(n.current.target).toBe("one");
    expect(n.current.overview).toBe(false);
    expect(n.entries).toHaveLength(1);
  });
  it("offers missing-anchor recovery even for a locationless current draft", async () => {
    const n = new Navigation(entry(""), () => {});
    await n.go("#missing", async () => entry(""));
    expect(n.fallback).toBeTruthy();
    await n.openAnyway(async () => entry(""));
    expect(n.current.overview).toBe(true);
    expect(n.entries).toHaveLength(1);
  });
  it("history restores all view fields and draft using fresh source analysis", async () => {
    const n = new Navigation(
      { ...entry(), view, draft: "unapplied" },
      () => {},
    );
    await n.go("https://example.org/b", async (uri) => entry(uri));
    const fresh = { ...entry(), source: "new source" };
    await n.go(fresh.uri, async () => fresh, 0);
    expect(n.current.view).toEqual(view);
    expect(n.current.draft).toBe("unapplied");
    expect(n.current.source).toBe("new source");
  });
  it("restores an archived visit after its stack position was replaced by a new branch", async () => {
    const n = new Navigation(entry(), () => {});
    await n.go("https://example.org/b", async (uri) => entry(uri));
    const archived = n.current;
    archived.view = view;
    archived.source = "old B source";
    await n.go("https://example.org/a", async (uri) => entry(uri), 0);
    await n.go("https://example.org/c", async (uri) => entry(uri));
    expect(n.entries[1].uri).toBe("https://example.org/c");
    expect(
      await n.go(
        archived.uri,
        async (uri) => ({
          ...entry(uri),
          source: "current B",
          draft: "B draft",
        }),
        archived,
      ),
    ).toBe(true);
    expect(n.current.uri).toBe(archived.uri);
    expect(n.current.view).toEqual(view);
    expect(n.current.source).toBe("current B");
    expect(n.current.draft).toBe("B draft");
  });
  it("reopen rejects coincident internal keys but re-resolves authored IDs", () => {
    const anonymous = {
      ...graph,
      nodes: graph.nodes.map(({ id: _id, ...node }) => node),
    };
    const old = { ...entry(), graph: anonymous };
    expect(
      restoreView(old, { ...old, attachment: "new" }, view),
    ).toBeUndefined();
    const renamed = {
      ...graph,
      nodes: graph.nodes.map((node) => ({ ...node, key: "new-key" })),
    };
    expect(
      restoreView(
        entry(),
        { ...entry("https://example.org/a", "new"), graph: renamed },
        view,
      )?.selected,
    ).toBe("new-key");
    expect(
      restoreView(
        entry(),
        { ...entry(), graph: { nodes: [], edges: [] } },
        view,
      ),
    ).toBeUndefined();
  });
});
