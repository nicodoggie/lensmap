# First Zed/browser integration implementation plan

**Goal:** Edit unsaved `.lensmap` source in Zed while a browser viewer updates
from valid analysis, follows the source caret on request/optionally, preserves
view state, and explicitly reveals source. Expose focused read/content-edit
operations on the same session, accepting Zed's application-time write race.

**Authority:** Nico approved starting the consolidated integration direction
and explicitly accepted the write-contention caveat on 2026-11-06. This plan
executes that first usable milestone; it is not a public schema freeze.

**Architecture:** A portable document package owns schema, source analysis,
identity/bindings and semantic snapshots. A controlled React viewer is consumed
by the existing playground and a browser bridge shell. A TypeScript stdio LSP
and secured loopback HTTP/SSE endpoint share live sessions, not disk snapshots.

**Stack:** Existing TypeScript/pnpm/Turbo/React/Vite/Vitest/Playwright, YAML and
Zod. Use the maintained vscode-languageserver library for stdio LSP framing.

## Accepted write limitation

Keep API base-revision checks and serialize owned writes. Apply minimal edits
to the attached live buffer, use native undo, and read actual changes back.
Zed may rebase an older edit if typing races with application; there is no
atomic compare-and-swap guarantee. Acknowledgment alone is not confirmation.
Report rejected, confirmed, or unconfirmed outcomes honestly. This accepted
limitation does not block initial write support and does not authorize saved
file replacement behind the editor, automatic retries or a collaboration system.

## Cross-lane contracts

### Document package

Owner: engine lane under `packages/document/src/**`. Parent owns manifests,
lockfile, existing web adapters and generated schema artifacts.

Export portable interfaces from `@lensmap/document`:

- `SourcePosition = { line: number; character: number }`, zero-based UTF-16.
- `SourceRange = { start: SourcePosition; end: SourcePosition }`.
- `SourceSpan = { start: number; end: number }`, UTF-16 string offsets.
- `Thought = { key: string; id?: string; title: string; markdown: string;
  unresolved: boolean; position?: { x: number; y: number }; path: string }`.
- `Connection = { key: string; from: string; to: string;
  kind: "branch" | "cross"; path: string }`.
- `SemanticGraph = { nodes: Thought[]; edges: Connection[] }`.
- `Binding = { key: string; kind: "definition" | "reference";
  span: SourceSpan; ownerKey?: string }`.
- `Diagnostic = { message: string; range: SourceRange }`.
- `DocumentSnapshot = { uri: string; revision: number;
  analyzedRevision: number | null; graphRevision: number | null;
  valid: boolean; pending: boolean; graph: SemanticGraph | null;
  diagnostics: Diagnostic[]; bindings: Binding[] }`.
- `ContentPatch = { summary?: string | null; full_text?: string | null }`.
- `PreparedEdit = { edits: { range: SourceRange; newText: string }[];
  source: string }`.
- `DocumentSession(uri: string, source?: string, revision?: number)` has getters
  `source` and `revision`; `receive(source, revision)` records source without
  parsing; `analyze()` analyzes the latest received revision;
  `update(source, revision)` combines them; `snapshot()` returns current state;
  `locate(position)` resolves a definition or reference target only when current
  analysis is valid; `definition(key)` returns a current definition range;
  `highlights(position)` returns definition/reference ranges for the target;
  `prepareContentEdit(key, patch)` returns validated, source-preserving changes.
- `positionToOffset(source, position)` and `offsetToPosition(source, offset)`.
- `DocumentSchema` and existing versioned schema exports; `generateJSONSchema()`.

Core graph nodes have no computed positions, camera, palette or DOM imports.
Preserve current shorthand/placeholder/reference/alias validation. Every thought
gets a session-stable internal key; rename/content edits and insertion before
siblings retain surviving keys. Copies get distinct keys. Source bindings must
not silently attach current positions to an invalid last-valid snapshot.

Identity starts with edit-aware range reconciliation plus strong unambiguous
content/name matches, not random regeneration on each parse. Ambiguous arbitrary
moves need no perfect cross-session identity promise. A valid snapshot's graph,
names and bindings advance together. Invalid/pending source retains last-valid
graph but disables unsafe source navigation/edit proposals.

For content edits, preserve unrelated source bytes/comments. JSON-quoted YAML
scalars are an acceptable first representation for changed scalar content;
block-style prettification is not required. Tests must include shorthand,
rich-node insertion, multiline Markdown and preservation of a nested subtree.

### Controlled viewer

Owner: viewer lane, `apps/web/src/Viewer.tsx`, `App.tsx`, `Sidebar.tsx`,
`SidebarResizeHandle.tsx`, `styles.css`, and new viewer-only helpers/tests.
Parent owns document adapters, bridge client, package/config files and e2e tests.

Export `Viewer` as default and named props from `Viewer.tsx`:

- `graph: GraphData` uses existing renderer `graph.ts` types and viewer layout.
- `updateMode?: "replace" | "live"`, default live. Replace preserves current
  playground Apply behavior; live retains surviving selection/camera/zoom.
- `focusRequest?: { key: string; sequence: number }` recentres without DOM focus.
- `onRevealSource?: (key: string) => void` enables explicit reveal action.
- `showInspector?: boolean`, default true; the bridge starts canvas-first with a
  Thought details toggle, without changing the standalone playground sidebar.
- `renderSidebar?: (context: { graph: GraphData; active?: GraphNode;
  onFocus: (key: string) => void; onFragment: (id: string) => void }) => ReactNode`.

The default controlled viewer has an optional details/connections inspector,
not a YAML source editor. The playground supplies its existing Sidebar through
`renderSidebar` and owns its source Apply graph state. Preserve all current
keyboard, lens, neighbourhood and connection-choice contracts. Cancel obsolete
pending interactions on graph changes; do not strand focus on deleted nodes.
A focus request is not a source edit or permission to take browser/editor focus.

### Bridge runtime

Parent owns `packages/language-server/**`, browser `BridgeApp.tsx`,
`bridge-client.ts`, preview entry/HTML, semantic-to-layout adapter, manifests,
Zed launch configuration/example, docs and acceptance tests.

- Use real stdio LSP: initialize, incremental UTF-16 open/change/close,
  diagnostics, document highlights as conditional caret input, definitions and
  basic authored-ID completion. Offer Open preview and Centre preview actions.
- Debounce analysis in the transport. Receive source/revision immediately.
  Publish last-valid graph plus pending/error status, never overwrite a newer
  source with an old parse. Caret resolution requires current valid bindings.
- Serve built preview assets on an ephemeral `127.0.0.1` port. Use same-origin
  authenticated session bootstrap, HttpOnly/SameSite cookie for SSE, and bearer
  authentication for tool API access. Validate Host/Origin and session document
  ownership. Do not log tokens, source content or private URL fragments.
- HTTP read endpoints expose current documents/snapshots and focused thoughts.
  A content-edit endpoint requires the base revision, prepares source-preserving
  edits, sends workspace/applyEdit and observes actual editor didChange before
  reporting confirmed. Retain the accepted rebasing race; no pretend CAS.
- Source reveal uses an injected host opener (real CLI only during authorized
  local/native acceptance), never arbitrary browser-supplied executable paths.
- Browser uses stable semantic identities and viewer-side layout. Reuse layout
  for prose-only edits; topology/authored-position changes can relayout. Retain
  camera/zoom/selection and last-valid graph across source errors/disconnection.
  Follow is a toggle; focus only when the owning key changes. Reveal is explicit.
- LSP shutdown/EOF closes HTTP/SSE resources. Serve no arbitrary workspace files.

## Task sequence and verification

### Task 1: contract and runtime prerequisites

Record the accepted caveat in `docs/integration-direction.md`. Add only real
consumed package manifests and build/test ordering following installed Turbo
docs. Parent owns dependency installation; workers never concurrently install.

Native evidence: frozen pnpm install and TypeScript/package resolution.

### Task 2: portable document engine and schema export

Write focused RED tests for stable identity/bindings, invalid/pending retention,
source-preserving content edits and JSON Schema parity for lost refinements.
Implement the core interfaces above, then run its owning test/type/build gates.
Use a maintained JSON Schema validator for representative parity, not bespoke
schema substring assertions. Export an explicitly experimental local schema.

### Task 3: controlled viewer extraction

Add focused browser RED coverage for externally supplied live graph updates and
focus requests preserving camera, focus and surviving selection. Extract the
viewer without changing standalone Apply behavior. Run existing browser cases
once its inputs are stable, not during parent/peer rewrites.

### Task 4: runtime and browser composition

Add a real stdio/loopback integration test before implementation. Cover source
updates, stale/error recovery, caret events, origin/auth rejection, base-revision
rejection, real edit readback and shutdown. Reuse the same representative fixture
rather than build a second generic protocol test framework. Wire preview assets,
client, layout preservation and actual Zed launch configuration.

### Task 5: user-visible qualification

Run `pnpm check` and `pnpm test:e2e` on stable integrated bytes. Exercise the
compiled stdio server through real Playwright: unsaved edits reach the map;
invalid source retains graph with status; caret follows without page focus
steal; explicit reveal is mediated; content edits return actual readback.
Repeat the essential path in an isolated installed Zed profile/display using
only synthetic workspace files, verify process cleanup, and document limits.

### Task 6: review and checkpoint

Freeze owned source/support for independent spec then quality/security review.
Parent validates findings, repairs and runs affected checks. Review/stage only
owned source/tests/docs/manifests/lockfile; commit a meaningful verified milestone.
No pushes, account/global settings changes or publication.

## Scope and stop rule

Complete the real preview milestone and the bounded content-read/write API,
not only libraries or a stub launch command. A full graph-editing CLI/MCP
catalog, create/reparent/delete operations, GPUI, other IDEs, universal plugin
infrastructure, new relation grammar and navigation polish are later work.
Do not claim this slice implements those adapters or strict editor CAS.

Use focused behavioral RED/GREEN and native tooling for declarative config.
Parent integrates concurrently with disjoint engine/viewer workers; independent
review is a milestone gate rather than one review per leaf helper. Existing
navigation and Markdown source fidelity remain regression requirements.
