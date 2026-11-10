# Node styling implementation plan

**Goal:** Implement document-local CSS-based node styling without changing graph
meaning, authored Markdown, navigation or the spatial lens contract.

**Architecture:** The browser-safe document engine parses and validates the two
style forms into one ordered presentation. The shared viewer owns measurements,
layout and CSS application. Existing bridge/framework transports carry ordinary
semantic data; they do not gain style-file discovery or executable CSS loading.

**Tech stack:** Existing TypeScript, Zod, YAML, css-tree, React, D3, Vitest and
Playwright; no new dependency or placeholder package.

## Task 1: Engine (exclusive document-package worker)

Read `docs/node-styling.md`, `HANDOFF.md`, `AGENTS.md`, schema/session/vocabulary
code and adjacent tests. Add focused failing tests to
`packages/document/src/node-style.test.ts`. Cover class source order, inline
specificity, important priority, shorthand ordering, both style forms, unknown
classes, CSS grammar/resource rejection, portals/references and stale recovery.
Implement `src/node-style.ts`, schema fields and `Thought.style` projection;
export the exact shared seam in the contract. Retain source field locations.
Run owning tests/typecheck/build from the explicit repository cwd. Do not commit,
change viewer/host files or regenerate root schemas while peers are working.

## Task 2: Viewer (exclusive apps/web worker)

Read the contract and existing graph/layout/Viewer/CSS/geometry helpers. Write
RED unit and real browser regressions for presentation projection and node
sizing. Thread `style` through all projections. Resolve normal font metrics and
rendered summary measurement; calculate base radius without shrinking fonts.
Use actual radii for layout, fitting, clearance and every connector route. Keep
unstyled behavior byte/geometry compatible where possible. Protect interaction
cues and preserve authored positions. Run owning unit/type/build checks and
focused Playwright after engine output is available. Do not commit or edit any
package outside `apps/web`.

## Task 3: Parent integration and authoring

Inspect the two implementations and fix cross-boundary defects. Verify generic
LSP diagnostics and snapshot transport with node styles. Add a documented
`examples/node-styling/map.lensmap` and include styled nodes in existing native
Astro/Starlight acceptance rather than inventing a new host. Regenerate the
owning document JSON Schema with `pnpm schema:export`; check representative style
inputs with the real schema/parser. Update current schema documentation.

## Task 4: Qualification and checkpoint

Run `pnpm check`, `pnpm test:e2e` and `pnpm test:packages`, retaining real logs
under ignored `artifacts/checkpoints/node-styling/`. Inspect desktop/narrow
screenshots with native vision. Obtain independent bounded spec/quality review;
fix actionable findings with focused evidence. Verify the reviewed source and
stage only the feature's source/tests/docs/generated schema. Make one meaningful
local milestone commit. Do not push, merge or publish, or republish local 0.2.1
artifacts over their immutable public versions.

## Progress

- Contract and disjoint ownership recorded; implementation authorized by Nico.
- Engine implementation received; parent CSS regressions reproduced and fixed
  native grammar, custom-property case sensitivity and numeric-name rule order.
  Focused engine tests, typecheck and build passed after the repairs.
- Native LSP integration passed (8 tests); Astro adapter passed (5 tests), and
  native Astro builds passed (2 tests). Both style forms and the self-contained
  example pass generated JSON Schema and engine analysis.
- Viewer implementation and parent integration are complete. Native Starlight
  acceptance reproduced and qualified the interaction-border measurement repair.
- Independent review found a hidden auto-size cache lifecycle defect; browser
  RED reproduced 290px becoming 86px after a neighbourhood refresh. Cache
  retention and remount measurement now pass refresh/return and restored-view
  regressions. Focused independent spec/quality recheck passed.
- `pnpm check` passed all 15 tasks; `pnpm test:e2e` passed all 43 Chromium tests;
  `pnpm test:packages` passed isolated production-tarball host/bridge acceptance.
  Desktop/narrow captures inspected; actual styled continuation contact checked.
  Whole-suite fixture JSX mode drift was diagnosed and repaired before the final
  passing browser run. Final evidence and limits are in `docs/node-styling.md`.
- All 28 feature files match the full-review plus focused-recheck candidates;
  only this documentation closeout follows review. Local milestone checkpoint
  follows Task 4; no push, version bump, merge or publication.
