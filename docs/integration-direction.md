# Lensmap: consolidated integration direction

## Status and purpose

**Historical design checkpoint:** the capability table below records the state
before the first integration implementation. Current local development setup
and implemented boundaries are in [Zed + browser preview](zed-browser.md);
executed evidence is in [verification](verification.md). Deferred goals here
remain deferred, not silently accepted new scope.

Design checkpoint from the folded IDE/API discussions and subsequent host
qualification on 2026-11-06. This records desired behavior, feasibility, and
remaining work. It is **not an implementation plan, a frozen public grammar,
or approval to start every future integration**.

The first usable integration should let Nico edit a `.lensmap` document in
Zed while a browser map tracks valid unsaved source and can follow the thought
under the caret, without losing editor focus or resetting exploration state.
Agents should use the same document semantics through focused APIs, not
manipulate renderer internals or automate dragging nodes.

## Product and document direction

- Keep the text-first mapping purpose: lightweight thoughts, explicit
  connections, cycles and convergence, with automatic initial presentation.
  Learning/training material and dependency maps are plausible uses, not a
  replacement product or authorization for a dependency-analysis platform.
- Prefer `.lensmap` for standalone documents: ordinary UTF-8 YAML containing
  Markdown, not a binary/archive format or generated diagram.
- Keep a format version inside the document. The current `version: v1` is
  incomplete and experimental; the extension does not freeze its grammar or
  require renaming existing YAML examples immediately.
- Keep authored IDs optional. Every thought needs an internal identity;
  authored IDs are optional names resolving to those identities, not mandatory
  generated metadata written back into the source.
- Preserve Markdown, lightweight shorthand and explicit unresolved thoughts.
  Prose links navigate; explicit connections alone define topology.
- Generate structural JSON Schema from the owning Zod input definition, not
  from a second handwritten schema. Preserve exportable constraints rather
  than silently publishing a weaker validator. Duplicate IDs, unresolved
  references and other document-wide checks remain engine responsibilities.

## Shared architecture

Keep Lensmap semantics host-independent, rather than building a generic graph
platform or forcing every host through an LSP.

| Component                          | Owns                                                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source document/tree               | Authoritative text, YAML syntax/CST, authored structure and source locations, including incomplete input                                                       |
| Document engine and bindings       | Validation, normalization, stable thought/edge identities, authored-name lookup, definition/reference bindings, semantic graph snapshots and change comparison |
| Viewer                             | Computed layout and measurements, rendering, camera/zoom, selection, lens projection and temporary neighbourhood geometry                                      |
| Language-service adapter           | Diagnostics, completion and associated semantic language features using the shared analysis                                                                    |
| Browser/host bridge                | Viewer updates, caret/source navigation, host lifecycle and source-edit mediation                                                                              |
| API, CLI and optional MCP adapters | Focused reads and semantic edit operations using the same engine and revision rules                                                                            |

Basic YAML syntax colouring and semantic language services are separate. The
LSP is not a camera protocol. It can share a process and document session with
an HTTP bridge without putting HTTP or editor-specific types in the engine.

### Identity and live updates

- Retain the source tree and a revision-bound binding index instead of
  discarding all source information after conversion to plain JavaScript.
- Distinguish definitions from reference occurrences and enclosing parents
  from nested thoughts. Source lookup is not simply any containing range.
- Preserve surviving internal identities through ordinary edits and alias
  renames. New/copied thoughts need distinct identities; arbitrary moves and
  ambiguous duplication still require a reconciliation policy.
- Receive buffer edits immediately, then debounce interpretation. Publish the
  semantic graph, alias lookup and bindings as a consistent valid revision.
- Compare authoritative semantic snapshots to derive targeted viewer changes.
  No event-sourced architecture or incremental YAML parser is required first.
  Wire snapshots need not imply rebuilding visual state.
- Preserve surviving selection, camera and zoom. Prose changes should not
  unnecessarily redo layout; topology and authored-position changes need an
  explicit layout invalidation policy. Small semantic deltas do not guarantee
  small layout effects.
- On syntax, schema or reference errors, keep the last valid graph usable and
  visibly mark it stale. Discard superseded analysis results. Never interpret
  a current caret through unadjusted last-valid source ranges: remap safely or
  decline that navigation until its ownership is known.

## Initial Zed workflow

Zed remains the first host because it is Nico's daily editor. Its current
ordinary extension surface did not yield an embedded web viewer. The selected
initial route is therefore a browser companion, not a change to VS Code-first.

The proposed process has two interfaces sharing one live document session:

- LSP on stdio for the editor connection and language services;
- loopback HTTP for viewer assets, document/graph access and browser updates.

The unsaved editor buffer is authoritative while attached. A browser renderer
must not quietly read older disk contents or overwrite the file behind it.

### Preview and navigation

- Use a canvas-first integration view without a duplicate YAML editor.
  Connections and rendered thought details remain available on demand; the
  exact drawer/popover/sidebar treatment is not settled. This does not remove
  the standalone playground's current sidebar.
- Centre the viewport on the thought owning the source caret without taking
  keyboard focus from Zed or rearranging authored geometry.
- Support an explicit centre-on-caret command. Automatic following is desired
  and has a qualified host signal; toggle/default and interaction with manual
  exploration still need a concrete interaction decision.
- Prefer recentering on a change of owning thought, not every character within
  its prose. This is a proposed follow policy, not shipped behavior.
- Keep Reveal in source explicit. Exploring the graph should not continually
  move the text cursor.
- Keep graph changes separate from view-only focus/camera events.

### Proposed bridge mechanics, not yet built

A same-origin viewer plus initial snapshots and an event stream is sufficient
for a first bridge. Server-sent events with ordinary HTTP commands are the
current recommendation, not a frozen transport contract.

Bind to loopback, use per-run authorization and origin checks, and limit access
and navigation to the intended session/workspace. Port discovery, browser
opening and server restart/disconnect behavior need implementation decisions.
Do not print plain URLs or logs into the LSP stdout stream. The language-server
process can own the endpoint lifecycle; no separate permanent daemon is needed.

## Agent/API/CLI/MCP direction and contention

- Expose semantic operations on thoughts, content, connections and authored
  structure, rather than renderer coordinates or raw internal implementation
  details. Exact method names and payloads remain undesigned.
- Offer search, compact thought/connection reads, focused neighbourhoods and
  full content only where needed. Token savings come from selective retrieval
  and focused edits, not the MCP transport itself; measure the benefit.
- Keep MCP a thin optional adapter. A CLI or another host can call the same
  engine/API without MCP being installed.
- Preserve unrelated source text, formatting and comments when editing.
  Validate edit batches as transactions and serialize this session's writes.
- Return document revisions with reads; require a base revision on changes.
  Reject stale bases, reread and retry rather than automatically merging.
- Keep writes routed to the authoritative editor buffer when attached, ideally
  as native undoable changes. Saved-file checking plus atomic replacement does
  not create a universal cross-process compare-and-swap.
- Zed's tested LSP edit path does not enforce strict whole-document revision
  equality at application time. Nico explicitly accepted that contention caveat
  for the initial implementation. Keep base-revision checks, serialize owned
  writes and verify actual buffer readback, but do not claim atomic application
  or treat `applied: true` as confirmation. A concurrent human edit may be
  rebased by Zed; report unconfirmed outcomes rather than silently retrying.
- OT, CRDTs and collaborative automatic merging are not first-iteration scope.

## What is feasible, and what that evidence actually establishes

The native host checks used installed Zed 1.27.0 on an isolated Linux/X11
display. Detailed cases, source pin and limitations are in the
[Zed feasibility record](zed-integration-probe.md).

| Capability                                 | Evidence/status                                                                          | Remaining boundary                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Existing lens playground and navigation    | Implemented in the web app                                                               | Not the new live IDE integration; navigation refinements are deferred                                              |
| `.lensmap` treated as YAML in Zed          | Native file-association check passed                                                     | Lensmap packaging and semantic language features are not shipped                                                   |
| Unsaved document synchronization           | Native LSP open/change check passed                                                      | Must connect to the real Lensmap engine/session                                                                    |
| Explicit caret command                     | Native task supplied file/position/selection                                             | Bind position to the correct source revision and viewer                                                            |
| Automatic caret signal                     | Native document-highlight requests matched seven keyboard/mouse cases                    | Conditional signal, not an unconditional cursor stream; multiword selection suppressed it                          |
| Reveal in source                           | Native CLI reached the requested file/line/column                                        | Browser-to-host command mediation and policy still need implementation                                             |
| Undoable buffer edits                      | Native current-version edit and undo passed                                              | Strict stale rejection and multi-document/concurrent behavior are not proved                                       |
| Strict editor-buffer compare-and-swap      | Not provided by the tested LSP path                                                      | Older revisions were accepted; a nonexistent revision still received a true acknowledgment without a source change |
| Generated structural JSON Schema           | Conversion of the actual recursive Zod input schema succeeds; rechecked for this summary | Current custom refinements for nonblank IDs and content-field presence are absent from the export                  |
| Ranged source tree and persistent bindings | Parser support for ranged syntax was investigated; the current pipeline drops it         | Binding retention and identity reconciliation must be built                                                        |
| Combined LSP/localhost/browser workflow    | Technically supported direction; separate host primitives qualified                      | The complete source-to-viewer loop has not been implemented or exercised                                           |
| Shared API/CLI/MCP operations              | Feasible architectural direction                                                         | No maintained semantic edit API or MCP adapter exists yet                                                          |
| Ordinary-extension embedded webview        | No usable public route established                                                       | Not a dependency of the selected initial browser workflow                                                          |

The current implementation still generates keys from structural paths in
`apps/web/src/document/parse.ts` and calls layout during parsing. Persistent
cross-revision identity and semantic/visual separation are desired work, not
properties to assume from the existing `GraphData` type.

## Still to build and explicitly deferred work

The implementation backlog is the real engine/viewer separation, bindings and
identity reconciliation, faithful schema export, live valid/stale updates,
Zed packaging and browser bridge, caret/reveal integration, and shared
revision-aware semantic APIs with CLI/MCP adapters. The initial write path may
proceed with the explicitly accepted non-atomic editor contention limitation.
The executing first-milestone contract is
[the Zed/browser integration plan](plans/zed-browser-integration.md).

A useful preview acceptance milestone is: edit an unsaved `.lensmap` in Zed;
the browser updates after valid analysis, preserves view state on ordinary
edits, shows stale status on invalid input, follows a resolvable caret without
stealing focus, and reveals source only on explicit request. That milestone
is not completion of all agent-editing work.

Deferred: GPUI rendering/native Zed embedding even if possible, possible later
VS Code-family support, Obsidian-specific integration, a universal plugin
framework, further navigation polish, and a custom `lensmap:` protocol until a
concrete need arises. Obsidian was an extensibility example for potential
contributors, not a planned target. Do not turn these into prerequisites for
Zed's browser bridge or scaffold empty packages for them.

## Provenance and current implementation references

- [Canonical product handoff](../HANDOFF.md)
- [Current web implementation](design.md)
- [Experimental schema](schema-v1.md)
- [Qualified host evidence](zed-integration-probe.md)
- Folded IDE discussion:
  <t3-thread://v2/83112fd3-0947-4d13-a1db-a76bf59117a7/639099e8-2c63-4f67-bffa-84172b27b0e7>
- Folded API/MCP discussion:
  <t3-thread://v2/83112fd3-0947-4d13-a1db-a76bf59117a7/1310bc8b-6f31-4a70-a80c-6a3d1126b1e8>

This checkpoint was checked against the current schema/parser and the retained
native evidence. JSON Schema conversion was freshly exercised. Application
unit/browser suites were not rerun for this documentation-only consolidation.
