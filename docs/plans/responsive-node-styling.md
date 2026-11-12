# Responsive node styling implementation plan

## Goal and authority

Implement the shared declarative positioning/media/container loop approved by Nico
on 2026-11-12, then show the actual result. Contract:
[responsive node styling](../responsive-node-styling.md). JS/TS preview modules,
package releases, pushes and website deployment are outside this work.

Execution is parent-owned integration with a bounded engine implementation worker
if useful; independent final review covers the stable integrated feature rather
than each leaf edit. Use focused RED/GREEN at the owning boundaries and verified
milestone commits, not per-step commits. Preserve concurrent user edits.

## Architecture

The document engine retains an ordered conditional declaration program and
resolves unconditional defaults without browser assumptions. The shared viewer
uses native media matching and an isolated native container-query probe to
resolve the same program before its existing sizing/layout/projection pipeline.
Keep the actual canvas's intrinsic sizing, source, selection and camera intact.

Proposed internal seam to qualify before relying on it: optional `conditions` on
style declarations, optional full `rules` program on conditional presentations,
`x`/`y` presentation metadata, and a pure `resolveNodePresentation` shared helper.
No new dependency or public authoring field is required. Existing uncomplicated
presentations keep their current shape and behavior.

## Task 1: Qualify native query evaluation

Use the existing installed Chromium and CSS parser to exercise a shadow-scoped
probe sized to the canvas, without changing the real container's containment or
intrinsic layout. Check matching, nonmatching and return transitions at fixed
browser width; separate native media width/preference behavior from container
width. Use one owned ignored artifact, not a new probe framework. Stop and revise
the mechanism if the native browser cannot provide the required semantics.

## Task 2: Document engine and conditional cascade

Owned source: `packages/document/src/node-style.ts`, `index.ts` and their existing
node-style/session tests. Extend declaration strings with nested `@media` and
unnamed size `@container` blocks, preserving all declarations and priority/order.
Validate every branch. Support finite numeric/`auto` coordinate properties and
retain original source locations. Keep YAML mapping shorthand compatible.

Add focused failing cases for matching cascades through an injected condition
predicate, important/inline order, inactive invalid CSS, nested conditions,
coordinate defaults and diagnostics. Implement and run the owning suite/build:

```sh
pnpm --filter @lensmap/document test
pnpm --filter @lensmap/document build
```

## Task 3: Shared browser resolution and layout

Owned source: `apps/web/src/Viewer.tsx`, `node-style.ts`, `graph.ts`,
`semantic-layout.ts`, `document/layout.ts`, and a focused shared query hook/helper
only if the qualified native mechanism requires it. Extend owning unit tests and
existing styling browser fixtures rather than adding a second renderer.

Resolve media changes through `matchMedia`. Resolve unnamed container size
conditions using the qualified isolated native mechanism. Reuse query results per
viewer/environment, never per-node independent observers. Apply resulting
appearance and independent coordinate constraints before layout; preserve
legacy position fallback and explicit `auto` release. Include effective pins in
layout invalidation; paint-only changes retain world coordinates. Geometry,
measurement, Overview, connectors, neighbourhood return and hit targets must
consume the same resolved graph. Resize does not reset navigation state.

Verify native units and existing styling/browser tests, plus a narrow embedded
canvas inside a wide window and a representative media preference change.

## Task 4: Transport, consumer integration and hero dogfood

Extend the existing `packages/language-server/src/server.test.ts` style case to
assert conditional program transport, stale/invalid recovery and source ranges.
Keep the LSP independent of browser environment. Inspect Astro snapshot and
semantic-to-renderer projections for dropped presentation fields; change only
real dropping seams.

Migrate `apps/site/src/maps/hero.lensmap` positions into authored conditional CSS.
Remove the portrait ID/position table from `apps/site/src/hero.ts`. Keep host
camera/lens policy, but frame from shared resolved geometry. Update existing hero
unit/browser cases as needed without weakening readable entry/focus behavior.
Read the current map before editing and preserve user changes. Document the
new syntax in owning docs and one self-contained responsive example if useful.

## Task 5: Integrated acceptance and visual delivery

Run owning unit/typecheck/build scopes, retained language-server transport tests
and existing viewer/site/bridge browser acceptance with responsive assertions.
Run native framework/packed-consumer acceptance where the public serialization
or declaration boundary changes; use the existing harness.

For the requested visual, use shared T3 preview tools on the locally built site
(status first) and the native inline HTML preflight/render surface for actual
captures. Show desktop and narrow outcomes from the real implementation; label
site-specific camera policy and any native editor restart still outstanding.
Never substitute a hand-positioned visual for the authored rule evaluation.

Review the stable feature independently for SPEC and QUALITY/SECURITY, reconcile
real findings, inspect the exact owned diff, and commit only reviewed source,
tests and docs. No publication. Completion is a working, exercised responsive
map in the shared viewer/site/preview paths, not a parser-only checkpoint.
