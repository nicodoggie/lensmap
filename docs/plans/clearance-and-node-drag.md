# Clearance-aware magnification and node drag implementation plan

## Approved scope

User approved a clearance limit after nonlinear projection, with the radial layout fixed. They additionally reported that map dragging fails over nodes. Implement both in the existing web app; do not change authored data, radial targets, camera-distance falloff, topology, or uniform post-lens zoom. No commits/publication.

## Design

- Add pure `apps/web/src/clearance.ts` with `limitMagnification`: take unit-zoom projected circles, keep their centres/payloads exact, and only reduce desired scales. For each conflicting pair, distribute available radius using smooth squared desired-radius weights, saturating at each desired radius. The more central (larger nominal) circle gets priority; combine pair limits conservatively so input iteration order does not select winners.
- Target a six-unit gap before uniform scene zoom. Retain a two-unit context-dot radius unless the nominal circle was already smaller; fixed coincident centres cannot simultaneously keep positive dots and guarantee separation. Blend correction continuously with lens strength below one and bypass it in Overview. Do not re-layout or run a live force solver while navigating.
- Render both circles and edge endpoints from the limited scales. Apply manual zoom only after limiting, using the existing shared DOM/SVG transform.
- Let map gestures begin on a node or background, but not zoom controls. Capture the pointer on its original node control (or the map background). Wait for four units of movement before panning; suppress the pointer click after an actual drag. Preserve ordinary node clicks, Enter/Space, touch capture, pointer cancellation and background-to-node crossing.

## Tasks and evidence

1. Add focused pure clearance tests for separation, centre/source preservation, central priority, order independence, continuity/zero strength and finite context dots for coincident positions. Witness RED before implementing the new seam.
2. Extend the existing Playwright boundary with a focused A-step-free-pier/200%-zoom all-circle overlap check and a node-start/background-crossing drag regression. Witness failure on actual pre-fix app; retain existing whole-scene uniform zoom and click/keyboard checks.
3. Implement the limiter and its App integration. Keep the current radial geometry unchanged; remove unused Dagre dependency only after confirming there is no remaining consumer. Implement thresholded drag and consumed-click handling in App.
4. Use native Biome format/check, Vitest, TypeScript/Vite build and Chromium via `pnpm check` / `pnpm test:e2e`. Inspect actual crowded-focus and Overview screenshots. Preserve the positioned archive's prior bytes, without adding a permanent checksum guard to editable source.
5. Finish README/schema/design/verification notes describing the radial default, view-only density correction and limits. Record actual outcomes, including any context readability compromise or impossible fixed-centre case. No delegation needed for this bounded change.
