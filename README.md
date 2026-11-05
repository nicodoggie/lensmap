# Lensmap

A text-first mind-map project exploring a **spatial magnification lens** for cyclic and converging graphs.

This is a working TypeScript/React lens playground—not a restoration of the pruned scratch HTML and not the finished authoring tool. See [HANDOFF.md](HANDOFF.md) for canonical decisions, [docs/design.md](docs/design.md) for scope, and [the incomplete v1 schema](docs/schema-v1.md) for the current YAML format.

## Run locally

Prerequisites: Node **24.16+** and pnpm **12.15.0** (the pinned package manager).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:5173**. The dev server binds to loopback by default. If that port is occupied, Vite prints the selected port.

After adding/removing dependencies, a long-running Vite process can retain obsolete optimizer metadata. If the page is blank with **504 Outdated Optimize Dep**, stop the Lensmap dev process and restart using the native optimizer rebuild: `pnpm --filter @lensmap/web dev --force --host 127.0.0.1 --port 5173 --strictPort`. Then reload the page. Do not restore retired packages or clear browser account data to repair a stale server optimizer. A successful production build or source-module HTTP response does not prove that the running dev page's optimized imports load.

- Drag the map background **or a thought** to pan. A short click selects; movement past a small threshold pans without activating the thought. Arrow keys pan when the map has focus.
- Scroll or use the −/+ buttons to zoom the entire graph uniformly, including peripheral circles, text and edges. Lens strength is a separate control for focus/context deformation; zoom does not change that relative sizing profile.
- Tab to a thought and press Enter/Space, or click it, to select and centre it.
- Selection softly glows the circle outlines of the selected thought and its immediate explicit neighbours, plus their incident connectors. Incoming/outgoing links and cycles count; more distant neighbours and prose-only references do not. The selected circle is slightly brighter instead of gaining an extra solid ring. Branch colours, cross-link dashes/arrows and keyboard focus rings remain visible in both Lens and Overview.
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
```

`check` runs Biome plus Turbo-managed unit tests, TypeScript checking (including browser tests/config), and the Vite production build. `test:e2e` builds and runs a small Chromium suite against a temporary loopback production-preview server on port **4173**; it refuses to reuse an existing server and shuts its own server down afterward. Screenshots/traces are local ignored test artifacts under `apps/web/test-results/`.

On Arch Linux, Playwright warns that it uses its Ubuntu fallback browser; browser installation or required system-library issues should be reported rather than treated as UI success. Chromium is test-only, not an application dependency.

## Workspace

- `apps/web` — React + Vite app, pure lens/camera/clearance functions, versioned Zod schema, YAML parser/normalizer, radial layout with D3 subtree hulls and initial collision relaxation, sidebar playground and tests. The editable sample is `apps/web/src/sample.yaml`.
- `packages/*` — reserved workspace glob only; no empty packages. Extract an embeddable viewer after the web interaction is qualified; language-server work follows that.
- `turbo.json` — local build/task orchestration; no remote cache or publication configured. The installed Turbo docs were read before defining tasks.

The samples use explicit branch/cross edges, Markdown notes and an unresolved-thought example. The default is automatically positioned; the saved comparison example retains its authored coordinates. The data is invented, not Bastion Falls canon. Durable persistence, import/export, a public viewer API, language server and advanced editor tooling are not implemented. Synthetic pointer/touch tests are not proof of physical comfort, large-graph performance or universal collision avoidance.

This folder is its own Git repository. Verified, meaningful milestones are checkpointed with local commits. Pushes, remote creation and publication require separate explicit approval.
