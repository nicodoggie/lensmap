# Keyboard navigation trial implementation plan

**Goal:** Integrate the merged three-style keyboard trial without changing authored layout or topology.

**Architecture:** Pure `navigation.ts` owns centre/spatial/explicit-edge candidate scoring and time-integrated pan math. `useMapKeyboard.ts` owns focus-scoped native key listeners, a held-key set and one animation frame loop. App retains separate camera, keyboard target and committed selection, feeding existing rendering/lens/clearance. No new dependencies, Turbo tasks or schema fields.

## Approved contract and bounded trial choices

- Arrows pan continuously; a small initial nudge supports taps. Holds accelerate from 120 px/s to a toolbar-configurable maximum (initially 900 px/s). Direction changes reset the acceleration; normalized diagonals have no speed bonus. Release, blur, hidden document, modifier changes, pointer/control intent, view/source replacement and unmount stop without coasting.
- Panning resets targeting to the nearest node centre within the 130 screen-pixel focus region, never the biggest circle or an arbitrary distant thought. Ctrl+arrows browse only visible centres with a stationary camera and unchanged committed selection. Fuzzy radial/tangential preferences are bounded proximity/alignment penalties, not graph depth or rigid rings. No wrapping; deterministic key ties. Releasing Ctrl retains the target.
- Space (optionally Ctrl+Space) commits and recentres the visible target within the current view. Enter accepts it and switches views like double-click; Shift+Enter remains a compatibility alias. Escape restores the pre-entry normal camera/view, without accepting a pending target or recentering. It may leave the latest committed thought's notes selected away from the restored centre.
- Shift+arrows follow actual explicit incident edges in either direction, ignoring loops/duplicate neighbours/prose. Trial junction policy: best directional alignment, then proximity and key. Visible geometry supplies bearings; hidden neighbours use their source displacement from the traversal origin so they remain traversable. Start from the visible keyboard target rather than stale selection. No directional destination means no-op, not an implicit acceptance.
- The same controls apply in lens and neighbourhood views; selecting in a neighbourhood derives that thought's temporary radial graph. Overview stays fit-to-map: plain pan is disabled there, spatial browsing and deliberate acceptance remain available. Enter from Overview can return via Escape to Overview.
- Bind only to the viewer background/node buttons. Textareas, inputs, toolbar/zoom controls, links and browser/system Meta/Alt/IME shortcuts keep their native behaviour; Tab remains native. A dashed target cue and accessible target announcement are distinct from selection glow and native focus.

## 1. Pure RED/GREEN boundary

Create `apps/web/src/navigation.test.ts`; witness missing seam RED with `pnpm --filter @lensmap/web exec vitest run src/navigation.test.ts`. Implement `navigation.ts` covering bounded centre selection, rotated fuzzy orbitals, deterministic/no-wrap/proximity choices, real bidirectional edge eligibility, hidden-neighbour fallback and integrated capped/normalized motion. Rerun the owning suite GREEN.

## 2. Rendered RED/GREEN integration

Create `apps/web/e2e/keyboard.spec.ts` using positioned YAML, real native key sequences and Playwright's clock. Witness missing target/hold behaviour RED against the built app. Add the hook and App state/cues/tuning; exercise Ctrl target persistence, Space acceptance, Shift origin/edge eligibility, Enter versus Escape, taps/holds/reversal/diagonals and cancellation/focus exclusions.

Migrate existing keyboard assertions from Enter-as-selection to Space-as-selection. Keep pointer double-click, source/draft, prose, zoom, glow and dragging coverage; update old document-wide Escape expectations to the new focus-scoped contract rather than retaining conflicting shortcuts.

## 3. Acceptance and checkpoint

Run focused gates during implementation, then `pnpm check && pnpm test:e2e && git diff --check` on stable bytes. Inspect actual target-cue desktop/narrow captures and a fresh live-dev session. Update README, design and verification with exact counts, actual RED/GREEN, tuning and unqualified physical/motion/large-graph limits. Obtain a read-only independent milestone review; parent fixes findings and stages/commits only owned source/tests/docs under standing local checkpoint authority. No push, PR or publication.
