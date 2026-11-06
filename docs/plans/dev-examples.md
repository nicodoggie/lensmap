# Development example maps implementation plan

> **For Hermes:** Execute this approved slice with focused behavior tests and native Vite evidence. Keep implementation parent-owned; obtain a bounded independent review before the milestone commit.

**Goal:** Make the existing example family usable through root-relative map URLs in the development playground.

**Architecture:** Vite serves `examples/` as its development-only public directory. The playground explicitly supplies its development origin as a root-relative fallback to navigation; a real source URI always wins. Production builds and the Zed bridge retain their existing behavior.

**Tech stack:** TypeScript, React, Vite, Vitest and local Playwright.

## Approved contract and scope

- `/` remains the playground; `/linked-maps.lensmap` serves the existing example unchanged.
- `/?map=/linked-maps.lensmap` establishes its real HTTP source identity. Its ordinary `./quickstart.lensmap` and `./night-ferry.lensmap#tides` links then resolve normally.
- A locationless development draft may activate an explicit `/example.lensmap` link. It must not invent a source base for `./example.lensmap` or scheme-relative addresses.
- Preserve existing raw-address validation, exact fragments, failed-load retention and Back/Forward behavior.
- Enable static examples only for the development command, not build or production preview. No example copies in built assets, proxy, custom filesystem endpoint, folder picker or expanded IDE authority.
- Own `apps/web/vite.config.ts`, `apps/web/src/App.tsx`, the small navigation seam and its existing test file, a focused development browser case, and relevant documentation. No dependencies, Turbo configuration, engine, bridge or example-source changes are required.

## Task 1: Root-relative navigation opt-in

### RED

Extend `apps/web/src/map-navigation.test.ts` to exercise `Navigation.go(raw, loader, historyIndex?, rootBase?)`: a locationless root-relative request uses an explicitly supplied origin, retains exact anchor targeting, and defaults to the existing missing-base error without it. Check real-source precedence and that ordinary relative, malformed and authority-relative addresses do not acquire this fallback.

Run `pnpm --filter @lensmap/web exec vitest run src/map-navigation.test.ts` and witness the new behavior fail.

### GREEN

Add the optional root-base argument within navigation's existing validation/error boundary. Pass `import.meta.env.DEV ? location.origin : undefined` only from the standalone playground. Do not change the IDE caller or generic `address` semantics.

## Task 2: Native development serving

Use Vite's configuration callback and `publicDir` pointing to the repository's `examples/` only when `command === "serve"` and not `isPreview`; use `false` otherwise. Keep the existing React, server, build and test configuration intact.

Validate through the actual Vite development server rather than string assertions over configuration. No new configuration test framework is warranted.

## Task 3: Actual consumer acceptance

Create `apps/web/e2e/dev-examples.spec.ts` using Vite's native server API on an owned loopback ephemeral port, closed after the case. Use the actual example files, without intercepted map responses. Check root serving, whole-map and exact-thought travel, Back, and activation of a root-relative portal in a pasted development draft. Keep a production-preview case proving the shortcut is absent and the example is not served as map data.

Run the focused browser cases and the relevant web tests/typecheck/build/lint. Inspect a real screenshot. Native build output must contain no copied `.lensmap` examples. Retain ordinary production portal/history coverage as the immediate consumer regression, without rerunning unrelated package publication/native-editor qualification.

## Task 4: Documentation and checkpoint

Document a clickable development entry in `README.md` and `examples/README.md`; reconcile the locationless-draft explanation in `docs/default-connections.md` with the explicitly dev-only root exception. Run Markdown checks and `git diff --check`, obtain independent review of the bounded candidate, and checkpoint only owned files locally. No push or publication.

## Standalone return controls

Expose visible **Back** and **Forward** controls in the standalone viewer toolbar,
not only in the IDE bridge. They traverse the retained map visits directly,
without invoking browser Back/Forward, and preserve view state and drafts.
Synchronize the current address with `replaceState`; ordinary portal travel still
creates browser entries. Retain browser visit snapshots separately so a native
Back/Forward traversal cannot resolve a reused map-stack index to the wrong map
after the viewer controls take a different branch.

Extend the existing missing-target browser case to use the explicit controls and
retain its full view/draft assertions. Extend the actual dev-example case to cover
a branched viewer/native-browser traversal. Add one focused navigation regression
for restoring an archived visit against current source analysis. The additional
owned paths are `apps/web/src/Viewer.tsx` and
`apps/web/e2e/portal-navigation.spec.ts`; the bridge stays unchanged.

The navigation restore argument accepts either its existing stack index or a
retained `MapEntry` visit. Browser entries hold in-session visit tokens rather
than treating a mutable array position as permanent identity. Replacement updates
reuse their current token instead of accumulating unused visit snapshots.
