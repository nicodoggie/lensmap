# Shift connection-preview implementation plan

**Goal:** Replace automatic Shift travel with the approved choose-an-exit, then-travel interaction.

**Architecture:** Extend the existing pure navigation seam with directional candidate groups and a fixed-origin preview session. App owns one pending choice independently of camera, committed selection and ordinary keyboard targeting. A compact in-view chooser names exits; actual full routes/continuation stubs receive temporary emphasis. No authored graph, layout/projection, dependency, schema or Turbo changes.

**Tech Stack:** Existing React/TypeScript graph model and scoped keyboard hook, Vitest/Playwright, pnpm/Turbo/Biome. No new dependencies.

## Contract

- Every Shift+arrow previews, including a sole exit. Capture the starting visible target as origin; freeze its displayed bearings for the choice session. Further presses choose that origin's actual incident neighbours, never walk from the candidate. Separate repeated presses cycle a directional group; direction changes restart another group. Ignore OS repeat for connection choices to avoid runaway cycling.
- Retain incoming/outgoing eligibility and the current directional cone/ranking as trial policy. Deduplicate destinations, retain all their real parallel routes/kinds/directions, ignore self-loops/prose and do not cap candidate counts. An empty group displays no exits; acceptance is a no-op rather than accepting the stale previous direction.
- Camera, committed selection/notes/glow and neighbourhood geometry remain unchanged while choosing. Show title, branch/cross-link and incoming/outgoing metadata, plus outside-this-view for hidden/offscreen destinations. Never add hidden circles/labels to the graph. Highlight only actual routes to the chosen destination; preserve source colour, dash, fade and arrow semantics.
- Space commits/recentres in the current view; Enter accepts/switches view. Escape cancels the pending choice first and restores ordinary targeting, without leaving a neighbourhood; a subsequent Escape uses normal map restoration. Modifier release does not accept. Clickable Preview options choose without travel; Go to thought and Cancel are explicit pointer/native-control alternatives. Choosing an option returns focus to the viewer.
- Clear pending choices on pan, zoom, spatial browsing, actual node focus/activation, view/reset, successful source Apply, projection/viewport changes. Do not steal editor/control focus. Invalid drafts retain the last valid graph and choice; editing shortcuts remain native. Preserve focus before removing chooser controls or a focused graph node.

## 1. Core RED/GREEN

Add `connection-choice.test.ts`, witness missing seams RED, then replace single-winner `connectionTarget` with `connectionCandidates` plus `stepConnectionChoice` in `navigation.ts`. Migrate its existing eligibility test, preserving original edge identities and directional fallback evidence. Verify fixed origin, stable bearings, full groups/metadata, deterministic ties, cycling/direction changes and empty groups without mutation.

## 2. Rendered RED/GREEN

Add `connection-choice.spec.ts` with real positioned YAML and incoming/outgoing branch/cross routes. Witness immediate auto-travel RED. Integrate `ConnectionChooser.tsx`, App session/accept/cancel lifecycle, current typed hook callback and full/stub edge preview styling. Migrate old tests to explicitly accept after Shift where they intend travel. Keep the existing node-focus removal regression across committed hops.

## 3. Qualification and checkpoint

Verify stable actual node/edge geometry during preview, candidate cycling, hidden cross-link naming/stub styling, empty groups, cancellation before Escape return, Space/Enter/pointer acceptance and focus. Inspect desktop/narrow captures; run `pnpm check && pnpm test:e2e && git diff --check` on stable source and a fresh live-dev check. Update README/design/verification with actual counts and limitations. Request one read-only milestone review; parent repairs concrete findings, then stages/commits only owned source/tests/docs under standing authority. No push/publication. Physical comfort, arbitrary degree/performance and junction tuning remain experimental.
