# Default connections implementation plan

## Authority and boundary

Implement `docs/default-connections.md`, including its completion defaults, as authorized by Nico's explicit implementation request. This plan does not authorize custom types, filesystem-wide access, desktop work, publication or a changed IDE host policy. Use focused RED/GREEN for executable behavior, native schema export for the generated artifact, and built-viewer/native-host proof for integration. No tests that merely assert specification prose.

The existing attached-buffer boundary remains authoritative. Local map navigation may consume attached valid documents; unattached resources fail visibly unless an already-authorized host path is qualified. Do not add a file server, proxy, helper or broader disk reads to make navigation pass.

## Shared contracts and ownership

Engine owner: `packages/document/**`, `schemas/lensmap.experimental-v1.schema.json`.

- Export `ConnectionType` with connected/precedes/follows/prevents/optional/external_link/map_link.
- `Thought.destination?: { kind: "map_link" | "external_link"; url: string }`.
- Semantic `Connection.type?: ConnectionType`, independent of `kind`.
- Export `connectionWording(type, direction)` where direction is outgoing/incoming.
- Export `thoughtAnchors(nodes): Map<string, string>` mapping thought keys to canonical authored/generated anchors; export `resolveThoughtAnchor(nodes, decodedAnchor): string | undefined`. Preserve exact authored names and avoid collisions with generated anchors. These functions consume thought key/id pairs, not renderer state.
- Preserve current session reconciliation and source-edit behavior; add optional attachment identity on snapshots if needed to distinguish reopened sessions, with compatibility for existing test fixtures.

Viewer owner: `Viewer.tsx`, `ViewerInspector.tsx`, `Sidebar.tsx`, `ConnectionChooser.tsx`, `NeighbourhoodContinuations.tsx`, `styles.css`, and focused new appearance helpers/tests/browser test file. No edits to App, BridgeApp or server.

- Consume optional node destination and edge type from graph types.
- Extend Viewer props with `onActivatePortal?: (node: GraphNode) => void`, `initialState?: ViewerState`, `initialTarget?: string`, `initialOverview?: boolean`, `onStateChange?: (state: ViewerState) => void`.
- Export `ViewerState` covering selected key, normal camera/strength/overview, temporary-neighbourhood flag/camera/strength and retained return-overview state. History must restore the whole view, not camera alone. Preserve surviving selection; never treat reopened attachment-local keys as global identity.
- Extend sidebar context with optional `onActivatePortal` so both inspectors expose explicit actions without removing local exploration.
- Single-click/Space select; double-click/viewer Enter activate portal. Normal thoughts retain existing behavior. Render canonical actual anchor IDs and scope fragment resolution to the graph.

Parent owns App/BridgeApp, graph/layout propagation, navigation/address/history modules, bridge client/server/main, language services, cross-map browser/native qualification and documentation. Shared source contracts above may be consumed during edits, but broad verification waits until writers are quiescent. Child workers do not stage, commit, reset, publish or delegate.

## 1. Engine RED/GREEN

Extend `packages/document/src/session.test.ts` with typed inline/referenced edges, unknown/ambiguous input failure, placeholder promotion, top-level/minimal/reused portals, per-reference relation independence and type/URL changes across revisions. Verify schema export with the existing Ajv parity seam. Test anchor collisions/exact matching and forward/reverse wording through owning exports. Run focused tests before implementation, then package tests/typecheck and native schema export.

Commands: `pnpm --filter @lensmap/document exec vitest run src/session.test.ts`; `pnpm --filter @lensmap/document test`; `pnpm --filter @lensmap/document typecheck`; `pnpm schema:export`.

## 2. Viewer RED/GREEN

Propagate semantic metadata through `graph.ts`, `semantic-layout.ts` and standalone parse/layout. Add focused appearance logic tests and one built-browser suite for relation markers on inline/reference/loop/continuation routes, endpoint icons, hover/keyboard descriptions, portal selection/activation and state restoration. Update old tests that intentionally assert superseded reference dashes/arrows, without deleting topology/navigation coverage.

Use `pnpm --filter @lensmap/web exec vitest run <owned-test-path>` after verifying the actual package name. Parent runs the built-browser suite after engine and viewer changes are integrated; child can witness a narrow RED before schema support exists and then use owning unit/static checks until integration.

## 3. Navigation and host RED/GREEN

Add pure address/history tests for source-relative URLs, exact once-decoded fragments, unsafe schemes, collisions, failed/superseded navigation and attachment invalidation. Implement reusable session navigation consumed by App and BridgeApp: hosted browser fetch; attached live-buffer host load; per-map in-session draft/view retention; browser/owned history; targeted Lens versus whole-map Overview; missing-anchor failure with real Open destination map anyway action.

Preserve auth bootstrap fragments and cookies. Add host-mediated external opening only through the configured host opener and attached thought identity; no arbitrary HTTP path opener or file reads. Native qualifiers must cover the actual host boundary available in the repository, not simulated acknowledgments. Explicit unavailable capability remains visible.

## 4. Integrated acceptance and checkpoint

Run focused new built-browser cases first, inspect desktop and narrow screenshots, then `pnpm check` and `pnpm test:e2e` against stable combined source. Exercise the actual stdio/HTTP bridge with attached unsaved local maps and verify no saved-file reads or source rewrites, plus hosted cross-map loading and browser Back/Forward. Check unopened local resources remain denied and missing anchors have the required working recovery action. Review the complete diff for spec coverage and access-boundary regressions; update current docs to distinguish implemented behavior and remaining native limitations. Make local commits at coherent verified milestones; no push/publication.

## Completion ledger

- [x] Typed authoring, source bindings, revision semantics and generated structural schema.
- [x] Default appearance, accessible/hover wording and first-class portal controls.
- [x] Real anchors and exact encoded fragment resolution.
- [x] Hosted and authorized attached-map loading, host external opening, no product privilege widening.
- [x] Full view/draft history, supersession and attachment-safe restoration.
- [x] Missing-anchor recovery opens the destination anyway; other errors retain current work.
- [x] New and existing unit/type/lint/build/browser suites and screenshots; native host behavior evidence with disclosed procedural deviations.
- [x] Current implementation docs; final repair-review and local checkpoint are closing gates, not claims inferred from this checklist.

See [qualification and limitations](../verification/default-connections.md) for commands, reproduced review findings, native evidence boundaries and remaining host limitations. The initial review candidate and subsequent repairs are distinct source identities; the final review/checkpoint must cover the repairs.
