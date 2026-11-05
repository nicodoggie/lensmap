# Neighbourhood navigation implementation plan

**Goal:** Integrate the approved interactive sketch into the actual web app, retaining connection identity, the stable regular map and source-editing behaviour.

**Architecture:** Compute a temporary radial one-hop graph from the canonical graph, preserving original objects/keys/kinds and never writing source positions. Feed those temporary coordinates into the existing spatial lens, clearance and uniform scene zoom. Render real boundary edges as outward-fading segments, without distant nodes/labels or false destination arrowheads. Keep neighbourhood camera state separate from the regular map camera. No dependencies, schema, sample or Turbo changes.

**Execution:** Parent-owned implementation and one reviewed milestone checkpoint; no leaf commits, remotes or publication.

## Approved interaction

- Ordinary map click selects/centres/glows as before. Double-click dives into the clicked thought's neighbourhood.
- Inside, clicking a thought shows its immediate incoming/outgoing neighbourhood; double-click surfaces in the regular lens map at that thought's authored/default world position.
- Provide an explicit Explore neighbourhood / Return to map action, a small neighbourhood context label, Shift+Enter on node buttons, and Escape outside editor inputs. Existing Enter/Space selection stays native and immediate.
- Resolve pointer single versus double clicks before moving geometry; keyboard and explicit controls are immediate. Cancel queued clicks on drag, source replacement, view/reset changes and unmount. A drag must not become a dive.
- Preserve source dash pattern and target-branch colour on all full/partial connections. Only opacity fades; incoming cross-link arrows remain at visible destinations, and outgoing cut-off ends have no false arrowhead.
- Keep quieter complete edges between visible neighbours, routing them around the centre. No prose-inferred topology or invented continuation rays.
- Pan/zoom a neighbourhood without recomputing its underlying arrangement. Recompute on navigation/source change, not camera movement. Use a short whole-scene fade on deliberate navigation, not detached animated node/edge endpoints; respect reduced motion.
- Successful Apply exits the temporary neighbourhood, preserves canonical ID-based selection recovery and cancels stale gestures. Invalid drafts preserve the current graph/view. Reset and Overview remain full-map operations.

## Task 1: Pure neighbourhood model (RED/GREEN)

Create `apps/web/src/neighbourhood.test.ts`, run `pnpm --filter @lensmap/web exec vitest run src/neighbourhood.test.ts` and witness the missing owning seam. Implement `apps/web/src/neighbourhood.ts` with deduplicated bidirectional adjacency, complete visible edges, boundary edges and source-bearing radial order. Test loops/parallel edges, transitive/prose exclusions, isolated/absent centres, deterministic immutable coordinates and an uncapped higher-degree ring. Use chord clearance to expand crowded rings rather than dropping neighbours.

## Task 2: Real renderer and gesture integration (RED/GREEN)

Add owning browser coverage in `apps/web/e2e/neighbourhood.spec.ts` for live sample navigation, actual click/double-click geometry, source-style/colour-preserving fading stubs, no fake outgoing markers, return to unchanged canonical geometry, keyboard alternatives and cancellation/source lifecycle. Witness RED against the current built app. Add `NeighbourhoodContinuations.tsx` and integrate view state/gestures into `App.tsx`, preserving existing DOM selectors and existing regression contracts. Add targeted CSS only in `styles.css`.

## Task 3: Qualification and checkpoint

Run native format, `pnpm check`, full `pnpm test:e2e`, and whitespace checks on stable bytes. Inspect desktop and narrow neighbourhood captures, including a cross-link-rich centre and a neighbour-to-neighbour connection. Freshly load the live dev app separately from the production suite. Update README/design/verification with real evidence and explicit gesture/performance limits. Freeze exact owned source/test/doc bytes and support closure, run a bounded read-only spec/quality review with T3 lifecycle checkpoint refs classified separately, reconcile findings/custody, then stage only reviewed paths and make one local milestone commit.
