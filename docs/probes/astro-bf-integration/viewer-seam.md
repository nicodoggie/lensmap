# Local viewer seam for the BF PoC

This is an exercised source-level embedding seam, not a published package or stable public API.

## Read-only consumer imports

- React viewer and types: `/home/ensu/Projects/lensmap/apps/web/src/embed.ts`.
- Scoped stylesheet: `/home/ensu/Projects/lensmap/apps/web/src/viewer.css`.
- Build-only layout helper: `/home/ensu/Projects/lensmap/apps/web/src/semantic-layout.ts`.

The entry exports `Viewer`, `ViewerInspector`, `layoutSemanticGraph`, `ViewerProps`, `ViewerSidebarContext`, `ViewerState`, `GraphData`, `GraphNode` and `GraphEdge`. Import the scoped stylesheet separately; `styles.css` is the playground's global document stylesheet and must not be imported by BF. The scope uses `:where(.lensmap-viewer)` so wrapping the existing rules does not increase their specificity against host/bridge overrides.

Pass the document engine's `SemanticGraph` through the existing `layoutSemanticGraph()` helper. It retains thought/edge keys and computes `GraphData` positions and branch colours. No lens/layout algorithm needs to be duplicated in the consumer.

## Embedded rendering

`Viewer` accepts `embedded: true` to render a `div` without the playground masthead or outer page padding. Ordinary app behavior remains the default.

Set `showInspector: false` for a canvas-only map. Supply `renderExternalInspector(context)` to render a host-owned inspector independently of that setting. The callback receives the same active thought, graph, `onFocus`, `onFragment`, optional thought URL and portal action as the built-in inspector. A consumer can return a React portal to its own sidebar mount so selection and connection navigation stay in one viewer session.

The consumer owns the portaled inspector's presentation and its prepared-content renderer. Trust authorization must come from the host/compiler policy; an HTML string or a precompiled asset does not authorize itself. This seam adds no runtime MDX compiler and does not change core frontmatter support.

## Verified viewer-side evidence

- Focused SSR regression: observed RED against the original viewer, then GREEN after adding embedded markup and external inspector context.
- Web unit suite: 12 files, 75 tests passed.
- Web TypeScript check and Vite production build: passed.
- Repository Biome check: passed with seven pre-existing informational template-literal suggestions in language-server tests.
- Existing built-browser suite: 37 tests passed, including standalone controls and the live editor bridge after scoping the styles.
- Final `git diff --check`: passed.

These results qualify the owned viewer change. BF's actual Elven Boons page and the parent shared-preview checks are recorded separately in [results.md](results.md), together with the private-hook, metadata-adapter and full-site qualification limits.
