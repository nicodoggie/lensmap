# Incomplete v1 schema and sidebar playground implementation plan

## Goal and approved refinements

Build the sidebar playground proposed in this thread, with the user's refinements: Zod, explicit `version: v1`, an incomplete/experimental schema, retained Explicit connections links, independently collapsible sections, and a resizable right sidebar. Execute locally without delegates, commits, publication, or unrelated edits.

## Architecture

Keep the portable Zod schema under `apps/web/src/document/v1/schema.ts`; YAML parsing, normalization and Dagre layout sit beside it rather than in the schema. Use the existing graph/lens renderer against normalized application data. An Apply action replaces the graph only after successful parsing, schema/reference validation and layout. A sidebar component owns its draft and independent section disclosures; the app owns the applied graph. Native details/summary controls preserve the navigation links; a desktop separator handles pointer and keyboard width changes. Narrow screens remain stacked.

## Task 1: Incomplete v1 boundary

Create `document/v1/schema.ts`, `document/parse.ts` and `document/document.test.ts`. Add focused RED tests for version selection, recursive string/rich shorthand, explicit empty placeholders versus absent content, strict reference/content distinction, optional IDs, duplicate/unknown references, malformed YAML and actual alias cycles. Implement using pinned Zod/YAML. Unknown fields fail explicitly instead of silently disappearing; this is the currently supported subset, not a frozen complete v1 spec. Do not add source-length, node-count or arbitrary graph-depth limits.

## Task 2: Normalized graph and layout

Create `graph.ts` and `document/layout.ts`; represent renderer keys separately from authored IDs. Preserve Markdown and optional summary without duplicated prose. Keep nested arrays as real unresolved nodes. Resolve explicit references in a second pass, including forward references, cycles and convergence; prose links do not create edges. Use maintained Dagre for missing positions only and retain supplied absolute x/y positions. Test these maintained seams, not Dagre's exact coordinates. Convert the sample into v1 YAML in `sample.yaml`, preserving its visible labels, Markdown and useful connections.

## Task 3: Sidebar and integration

Add `Sidebar.tsx` and `SidebarResizeHandle.tsx`; patch `App.tsx` and `styles.css`. Preserve Selected thought / Explicit connections links; add a YAML playground section with Apply and Load sample. Drafts survive collapse and view/selection changes; Load sample replaces the draft only, with Apply still explicit. Validation errors preserve the applied graph and raw draft. No disk persistence is implied. Handle empty documents. Render summary as Markdown and preserve full content in notes. Resize with pointer capture and keyboard arrows/Home/End, within responsive map/sidebar minimums. Hide the handle in stacked layout.

## Task 4: Integration evidence and documentation

Extend the existing `e2e/lens.spec.ts` with one representative authoring/sidebar test: apply YAML, navigate explicit/prose links, reject bad input without graph loss, preserve draft across collapses/selection, resize by pointer/keyboard, and capture desktop/narrow layouts. Retain existing spatial interaction tests, changing fixture-key selectors to stable visible labels where needed. Run focused RED/GREEN for owned behavior, then `pnpm format`, `pnpm check`, `pnpm test:e2e`, frozen-lockfile installation and whitespace checks. Inspect real screenshots. Update README/design/evidence and write `docs/schema-v1.md`; keep advanced editor tooling, section anchors, persistence, embedding/LSP and full-content overview deferred.
