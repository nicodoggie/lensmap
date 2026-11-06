# Lensmap

A text-first mind-map project exploring a **spatial magnification lens** for cyclic and converging graphs.

This is a working TypeScript/React lens playground—not a restoration of the pruned scratch HTML and not the finished authoring tool. See [HANDOFF.md](HANDOFF.md) for canonical decisions, [docs/design.md](docs/design.md) for scope, and [the incomplete v1 schema](docs/schema-v1.md) for the current YAML format.

The recommended way to use the **live Zed/browser integration** is to build
this checkout and install it as a **Zed dev extension**:
[setup, usage and API](docs/zed-browser.md). It consumes unsaved
editor buffers, retains valid maps across source errors, supports optional caret
follow and explicit source reveal, and mediates bounded content edits with
revision checks and real buffer readback. Editor application is **not atomic**.
The [integration direction](docs/integration-direction.md) preserves the earlier
design checkpoint and deferred goals.

The `@lensmap/document` and `@lensmap/language-server` npm packages now have a
qualified local pack/install path and a prepared, approval-gated release
workflow. **They have not been published by this preparation.** See
[package verification and release setup](docs/npm-release.md). Zed registry
publication and its automatic npm runtime installer remain deferred; no GitHub
release is needed for the current dev-extension flow.

## Run locally

Ready-to-open `.lensmap` files are in [examples/](examples/README.md): start with
[quickstart](examples/quickstart.lensmap), or explore the larger
[Night Ferry](examples/night-ferry.lensmap) map. For live Zed preview, follow
the [editor setup](docs/zed-browser.md).

Prerequisites: Node **24.16+** and pnpm **12.15.0** (the pinned package manager).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:5173**. The dev server binds to loopback by default. If that port is occupied, Vite prints the selected port.

After adding/removing dependencies, a long-running Vite process can retain obsolete optimizer metadata. If the page is blank with **504 Outdated Optimize Dep**, stop the Lensmap dev process and restart using the native optimizer rebuild: `pnpm --filter @lensmap/web dev --force --host 127.0.0.1 --port 5173 --strictPort`. Then reload the page. Do not restore retired packages or clear browser account data to repair a stale server optimizer. A successful production build or source-module HTTP response does not prove that the running dev page's optimized imports load.

- Drag the map background **or a thought** to pan. A short click selects; movement past a small threshold pans without activating the thought. Arrow keys pan when the map has focus.
- Scroll or use the −/+ buttons to zoom the entire graph uniformly, including peripheral circles, text and edges. Lens strength is a separate control for focus/context deformation; zoom does not change that relative sizing profile.
- **Ctrl+= / Ctrl+-** zoom the map while its background or a thought has focus; **Ctrl++** also zooms in. They use the same steps/limits as the zoom buttons in Lens and neighbourhood views. In Overview they leave its fit unchanged. Only matching viewer-focused shortcuts prevent browser zoom: editor, sidebar and toolbar/zoom-control focus leave the browser shortcut untouched. Alt/Meta/IME combinations are not intercepted.
- Tab to a thought and press **Space**, or click it, to select and centre it. While the viewer background or a thought has focus, a dashed pale target cue shows what Space/Enter will accept, independently of the selected thought's notes and glow.
- **Arrows** pan continuously; holding accelerates toward **Pan max** (initially 900 px/s). Releasing stops immediately, reversals reset acceleration and diagonals have no speed bonus. Panning returns targeting to the nearest centre within the central 130 px region; if it is empty, Space/Enter do nothing rather than choosing a distant thought.
- **Ctrl+arrows** browse visible node centres using directional proximity and soft orbital preferences around the stationary lens centre. Camera and committed selection stay unchanged; releasing Ctrl retains the target. **Space** (or Ctrl+Space) accepts and recentres it within the current view. No wrapping or implicit auto-pan.
- **Shift+arrows** preview actual incoming/outgoing connections without moving the camera, replacing selected notes or rearranging the neighbourhood—even for a single exit. The starting target stays the origin until you accept or cancel. Repeating a direction cycles its exits; changing direction starts another group. The chooser names destinations, branch/cross-link kind and direction, marking hidden/offscreen destinations **outside this view**. Real connecting paths/stubs get an extra highlight; distant graph nodes are not added. Prose links and self-loops are not travel destinations. **Space** accepts/recentres; **Enter** accepts/switches views. **Escape** cancels the choice first. Empty groups cannot accept the previous direction's destination. OS key repeat does not cycle choices; make separate presses. Directional cone/ranking and hidden source-bearing fallback remain experimental.
- Selection softly glows the circle outlines of the selected thought and its immediate explicit neighbours, plus their incident connectors. Incoming/outgoing links and cycles count; more distant neighbours and prose-only references do not. The selected circle is slightly brighter instead of gaining an extra solid ring. Branch colours, cross-link dashes/arrows and keyboard focus rings remain visible in both Lens and Overview.
- **Enter** accepts the target and switches views like double-click: from the map it opens that thought's temporary radial neighbourhood; from a neighbourhood it returns to the normal map centred on that thought. With no pending connection choice, **Escape** dismisses the neighbourhood and restores the map camera/view you left, without accepting a pending spatial target. Shift+Enter remains an alias for Enter. Chooser options preview before travel; **Go to thought** and **Cancel choice** are explicit alternatives. Pan, zoom, spatial browsing, node/view/source replacement and viewport/projection changes clear stale choices. Invalid drafts retain the last valid graph and choice. Click a neighbour to explore from it; Explore neighbourhood / Return to map remain explicit actions. Lens and Overview also return to the full map.
- Neighbourhoods retain quieter real connections between visible neighbours. Short outward-fading lines hint at connections beyond the view, without showing distant nodes or labels. Solid/dotted patterns and original colours stay unchanged; cut-off outgoing ends do not gain false destination arrows. Pan and uniform zoom still work; returning preserves the normal map's layout, zoom and lens settings.
- Pointer node clicks use a **350 ms double-click resolution window** before moving geometry; Enter/Space, sidebar links and explicit controls remain immediate. Dragging or new control/source intent cancels queued activation. Deliberate neighbourhood navigation uses a brief whole-scene fade, disabled for reduced motion. Gesture comfort and compact narrow-screen labels remain hands-on evaluation work.
- Viewer shortcuts do not intercept source editing, toolbar/zoom controls, links, native Tab navigation or Alt/Meta/IME input. Holds stop on viewer/window focus loss, backgrounding and new pointer/view/source intent; they do not resume from a stale held-key state. Overview remains fit-to-map with plain panning disabled, while target browsing and deliberate acceptance remain available. Pan tuning is session-only, not an authored schema field or persisted preference.
- Follow the Markdown prose reference in the notes: selection changes, graph edges do not.
- Switch to **Overview** for undistorted positions; select a node to return to the lens. Overview is read-only navigation, not a full-content expansion.
- **Reset view** restores the initial camera, thought, lens strength and mode.
- Open **YAML playground** in the sidebar, edit the source and choose **Apply YAML**. The Zod schema requires `version: v1`; v1 is explicitly incomplete and experimental. Invalid source leaves the last valid graph intact.
- Positions and authored IDs are optional. Missing positions receive a subtree-aware radial layout: padded branch contours reserve angular room in source order, rather than giving every subtree an equal fan. Branches widen their outward fan before locally lengthening links when needed. Explicit coordinates stay exact; cross-links/cycles do not reparent nodes. **Load sample** replaces the draft only; Apply still controls the map.
- Collapse **Selected thought**, **Explicit connections** and **YAML playground** independently. Drag the divider to resize the desktop sidebar, or focus it and use Left/Right/Home/End. On mobile the sidebar stacks below the map.
- Drafts survive view/selection changes, but **reloading discards edits**. There is no durable saving yet.

Lens placement and desired circle size share one nonlinear spatial falloff, with no extra logarithmic distance warp. A clearance limit then reduces crowded circles, favouring more central circles, **without moving their centres or changing the radial layout**. This happens before uniform manual zoom; edge endpoints follow the actual limited circles. Below normal lens strength the correction blends in continuously, and Overview/zero strength remain undistorted. Very dense or coincident authored positions retain small context dots rather than gaining an impossible universal separation guarantee. This is not a full-content view; complete notes remain in the sidebar.

Zoom is applied after the lens, so every graph element grows or shrinks by the same factor while the controls and sidebar stay fixed. Zooming in can intentionally move outer ideas offscreen; zoom out or pan to reach them.

The default [sample](apps/web/src/sample.yaml) has no custom positions and uses automatic layout. The exact earlier [positioned sample](apps/web/examples/night-ferry-positioned.yaml) is preserved separately for comparison. Their thoughts, Markdown, IDs and connections are identical; only the position fields differ. In an already-open tab, **Load sample → Apply YAML** loads the automatic version without forcing a page reload (Load sample replaces the current draft).

After an automatic-layout update, choose **Apply YAML** again to regenerate positions from your current valid draft. Inspect **Overview** for the underlying branch arrangement, then return to Lens. The contour-packing experiment leaves the lens, clearance policy and sample data unchanged; manual pins can still impose conflicting geometry.

## Verify

```sh
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:packages
```

`check` runs Biome plus Turbo-managed unit tests, TypeScript checking (including browser tests/config), and the Vite production build. `test:e2e` builds and runs a small Chromium suite against a temporary loopback production-preview server on port **4173**; it refuses to reuse an existing server and shuts its own server down afterward. Screenshots/traces are local ignored test artifacts under `apps/web/test-results/`.

`test:packages` packs the document/server tarballs, installs production
dependencies in a disposable consumer outside the workspace, checks public
exports/types and the executable, then runs the existing bridge browser cases
against that installed server and its bundled assets. It does not publish or
change editor settings. `pack:packages` builds tarballs without install acceptance.

On Arch Linux, Playwright warns that it uses its Ubuntu fallback browser; browser installation or required system-library issues should be reported rather than treated as UI success. Chromium is test-only, not an application dependency.

## Workspace

- `apps/web` — React + Vite playground and canvas-first bridge shell sharing a controlled viewer, lens/camera/clearance functions and viewer-owned radial layout. The editable sample is `apps/web/src/sample.yaml`.
- `packages/document` — portable Zod schema, YAML source analysis, revision-bound bindings, session identities, semantic graphs and source-preserving content-edit preparation. No DOM, camera or LSP ownership.
- `packages/language-server` — stdio language services and authenticated loopback HTTP/SSE bridge over the same attached document sessions.
- `editors/zed` — minimal Rust/Wasm launcher for the configured TypeScript server, not a native renderer. No placeholder packages or published extension.
- `turbo.json` — local build/task orchestration, including web assets before the server's package-local preview copy; no remote cache. The installed Turbo docs were read before defining tasks.
- `.github/workflows/npm-release.yml` — prepared npm verification/release flow; actual publishing needs package trust setup, a protected `npm` environment and an explicitly authorized matching release tag.

The samples use explicit branch/cross edges, Markdown notes and an unresolved-thought example. The default is automatically positioned; the saved comparison example retains its authored coordinates. The data is invented, not Bastion Falls canon. Durable playground persistence, import/export, a published viewer API, full CLI/MCP graph editing and embedded Markdown editing assistance remain deferred. The current LSP offers diagnostics, definitions, document highlights, basic authored-ID completion and preview code actions; it is not a full editor-tooling implementation. Synthetic pointer/touch tests are not proof of physical comfort, large-graph performance or universal collision avoidance.

This folder is its own Git repository. Verified, meaningful milestones are checkpointed with local commits. Pushes, remote creation and publication require separate explicit approval.

## License

Lensmap, including its Zed extension, is licensed under the [MIT License](LICENSE).
