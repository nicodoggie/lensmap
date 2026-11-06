# Zed integration feasibility

## Verdict: partial, with native evidence

Zed can supply the source-editing half of a Lensmap workflow. The installed
editor demonstrated unsaved-buffer synchronization, explicit caret commands,
conditional automatic caret signals, source reveal, undoable buffer edits,
and `.lensmap` association with YAML. It did **not** establish an embedded
graphical viewer or strict apply-time revision rejection.

This is a feasibility record, including subsequent direction agreed with Nico,
not an implementation plan or authorization to build an adapter, change the
authoring grammar, or rename fixtures.

## Qualification scope

- Observed on 2026-11-06 using installed Zed **1.27.0**, with source pinned to
  `c84af5b99cbc366d675064e52b23664a015b6e35`.
- Native editor exercised on Linux in a private Xvfb display, with disposable
  files, a recording stdio LSP, task/keymap fixtures, and separate editor
  settings/data. This is not Wayland, macOS, Windows, or physical-keyboard
  qualification.
- LSP transport was exercised through an existing Rust language attachment with
  synthetic `main.rs` and `caret.rs` fixtures, not a shipped Lensmap extension.
  YAML file association was a separate native check; its language servers were
  disabled.
- No application code, dependency manifests, real editor settings, or accounts
  were changed. The owned editor/display process groups were confirmed gone
  afterward.

## Capability findings

| Boundary                        | Evidence and result                                                                                                                                                                       | Limit                                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Standalone `.lensmap` text file | Configured `file_types` to associate `lensmap` with YAML. Native editor displayed syntax highlighting, and a task reported the fixture language as `YAML`.                                | Does not establish schema diagnostics, embedded Markdown tooling, or Lensmap semantics.                                                     |
| Full unsaved source             | Recorder received the initial buffer through `textDocument/didOpen` and subsequent unsaved typing through incremental `textDocument/didChange`. Disk contents stayed unchanged.           | Requires a real language-server attachment and revision-consistent analysis; a file watcher alone is insufficient.                          |
| Explicit caret command          | A named task bound with `task::Spawn` supplied the active file, row, column, language, and selection.                                                                                     | This is command-driven. See the separate automatic-signal follow-up below; coordinates and analysis must use the corresponding live source. |
| Automatic caret signal          | With `documentHighlightProvider` advertised, native arrow movement and mouse clicks generated position-bearing `textDocument/documentHighlight` requests without source edits.            | Conditional language-feature requests, not an unconditional caret subscription; multiword selection suppressed the tested signal.           |
| Unsaved selection               | Select-all followed by the task returned text identical to the live buffer reconstructed from LSP notifications, including unsaved edits.                                                 | A selection task is not automatic full-buffer synchronization.                                                                              |
| Reveal in source                | Invoked the installed CLI with the private user-data directory, `--existing`, and `association.lensmap:3:5`. A subsequent task reported that exact file, row `3`, and column `5`.         | This proves local CLI-to-editor navigation, not browser permission to launch a local process or preservation of viewer focus.               |
| Undoable buffer edit            | A current-version `workspace/applyEdit` changed the live buffer without writing the file. One native Undo removed the server edit while retaining preceding human typing.                 | Multi-document atomicity, overlapping edits, redo, and sustained concurrent writers were not tested.                                        |
| Reject any stale revision       | **Not supplied by the tested LSP path.** An edit naming revision `0` was accepted while the buffer was at revision `7`, and changed the live buffer.                                      | The human change was in a different range; this demonstrates stale acceptance, not an overlapping-edit conflict policy.                     |
| Trust the edit acknowledgment   | **Not reliable as sole evidence in this build.** A nonexistent revision returned `applied: true` while the buffer remained unchanged.                                                     | Verify actual resulting source; do not treat the acknowledgment as a successful write receipt.                                              |
| Embedded React/SVG viewer       | No general custom-pane/webview API found in inspected public extension docs and the installed-version extension trait. The webview extension request remained open when checked.[2][4][9] | No embedded viewer was demonstrated. This is not proof that a Zed core change or future API could never provide one.                        |

The task route and file association are documented host mechanisms, now also
exercised natively.[1][6] The inspected extension interface supplies
language-server integration hooks; it is not a general UI toolkit for arbitrary
extension panes.[4]

## Revision behavior: why the write contract needs more work

The recorder sent actual `workspace/applyEdit` requests to the installed editor
and logged its responses. Buffer effects were checked through subsequent LSP
changes and a native selected-text task, rather than inferred from
acknowledgments.

| Request                | Requested version | Latest observed version before request | Response        | Observed buffer effect                                                        |
| ---------------------- | ----------------- | -------------------------------------- | --------------- | ----------------------------------------------------------------------------- |
| Current edit           | `5`               | `5`                                    | `applied: true` | Function name changed; native Undo restored it without removing human typing. |
| Older retained version | `0`               | `7`                                    | `applied: true` | Function name changed despite the stale document revision.                    |
| Nonexistent version    | `99999999`        | `8`                                    | `applied: true` | Buffer remained unchanged.                                                    |

The pinned implementation passes versioned edits through its LSP edit conversion
and creates undo transactions. Its `on_lsp_workspace_edit` handler logs
deserialization/application errors but constructs an `applied: true` response
even when no transaction was obtained, matching the negative native case.[5]

Consequences for the agreed optimistic-concurrency direction:

- Keep revision-bearing reads and explicit base revisions on proposed edit
  batches. Reject a base already known to be stale before sending anything to
  the editor.
- Do **not** describe that server-side check as an atomic editor-buffer
  compare-and-swap. Human typing can occur between the check and client
  application, and the tested client accepts an older retained version instead
  of enforcing whole-document equality.
- Do not silently replace the agreed reject/re-read/retry policy with Zed's
  rebasing behavior. A strict apply-time precondition remains an unresolved host
  capability.
- Confirm the resulting live source and expected edit effects before reporting
  success. Post-application verification is evidence, not a replacement for an
  atomic precondition.
- If the first host adapter cannot enforce the required write contract, expose a
  proposed patch/explicit application path rather than unattended agent writes
  or saved-file replacement behind an unsaved buffer.

This finding changes the implementation risk, not the intended API/CLI/MCP
semantics. OT, CRDTs, automatic merging, and a general collaboration service are
not prerequisites established by this probe.

## Position encodings are not interchangeable

At the end of the synthetic line `// café 🧭`, the task reported row `2`, column
`14`. That matched a one-based UTF-8 byte column. The corresponding one-based
UTF-16 column was `11`, and the Unicode-code-point column was `10`. The recorder
explicitly negotiated UTF-16 LSP positions.

An adapter must convert task positions using the corresponding live source and
the negotiated LSP encoding. The ASCII-only CLI reveal check does not
independently establish CLI Unicode column units. Do not use coordinates from
current source against an unadjusted last-valid binding index.

## Follow-up: automatic caret signals qualified

The initial recorder advertised source synchronization but not document
highlighting. A follow-up recorder advertised `documentHighlightProvider: true`
and returned empty highlight results while recording actual client requests.
Zed sent `textDocument/documentHighlight` positions automatically after caret
movement, with no hotkey command, saving, or source edits required.

| Native movement case                                      | Observed zero-based UTF-16 position | Result                               |
| --------------------------------------------------------- | ----------------------------------- | ------------------------------------ |
| Move into an identifier                                   | Line `2`, character `9`             | Expected request received            |
| Move one character within that word                       | Line `2`, character `10`            | Expected request received            |
| Move into indentation                                     | Line `2`, character `2`             | Expected request received            |
| Move to a blank line                                      | Line `3`, character `0`             | Expected request received            |
| Move to punctuation                                       | Line `2`, character `14`            | Expected request received            |
| Move within a comment containing non-ASCII text and emoji | Line `4`, character `25`            | Expected request received            |
| Click another source line                                 | Line `5`, character `11`            | Request received on the clicked line |

All seven collapsed-caret cases matched. Disk bytes and the live source stayed
unchanged. A native selection spanning `Alpha thought` produced no highlight
request for its final head position; a screenshot confirmed the selection and
focused editor rather than an intervening modal.

The pinned selection code refreshes document highlights on local selection
changes. The highlight implementation uses a configurable debounce and skips
requests when selection endpoints have different surrounding-word ranges; it
also has other guards such as pending rename state.[18][19]

This supports a Zed-specific automatic-follow adapter, not a universal LSP
caret-event API. Lensmap can implement meaningful thought/reference highlighting
and also use the incoming position to resolve the owning thought. The browser
bridge can publish that focus separately from graph changes. A follow toggle,
centring only when the owning thought changes, and an explicit caret command
as fallback are proposed interaction choices, not implemented behavior.

The native experiment qualified the signal, not an end-to-end moving Lensmap
viewer. Source bindings, revision association, invalid-source behavior, focus
preservation, other selection modes, and actual Lensmap language attachment
still need integration proof. Do not substitute a last-valid source range map
for bindings matching the current position.

Receipts are `caret-results.json` and `caret-events.jsonl` in the same private
scratch root, with `caret-initial.png` and `caret-after-cases.png` captures.
The follow-up editor/display process groups were confirmed gone afterward.

## Architecture implications, not new implementation scope

1. **Keep Zed as source editor.** The live-buffer boundary is feasible; a second
   YAML editor inside the viewer is unnecessary for this workflow.
2. **Keep shared semantics outside host-specific adapters.** The document engine
   owns parsing, validation, identities, source bindings, and semantic graph
   snapshots. LSP, CLI, API, and optional MCP consume that engine rather than
   reimplementing it.
3. **Separate language service from viewer transport.** LSP can provide a
   revisioned source session and editor language features; that does not make it
   a camera protocol or a graphical host.
4. **Use qualified caret signals without overstating integration.** Tasks
   provide explicit positions; document-highlight requests provide conditional
   automatic positions. Live revision matching, the viewer handoff, and keeping
   editor keyboard focus still require integration proof.
5. **Use the selected browser-bridge direction.** Nico subsequently accepted an
   external viewer for the initial Zed workflow and proposed co-hosting a
   localhost endpoint in the language-server process. Exact transport,
   authorization, and lifecycle remain design work. A possible GPUI renderer
   for future native embedding is explicitly deferred even if hosting becomes
   available; do not add it to the current bridge scope.
6. **Do not turn language association into grammar approval.** `.lensmap`
   remains ordinary text in this exploration. Generated JSON Schema,
   preservation of refinements, semantic diagnostics, and public schema/version
   policy were not implemented by this probe.

## Probe setup corrections and reproducibility

- On this Arch installation, `/usr/bin/zed` belongs to `zfs-utils`; the editor
  executable is `/usr/bin/zeditor`. Identify the binary before using editor
  commands.
- With `--user-data-dir <dir>`, this version loads settings/keymaps from
  `<dir>/config`, rather than the otherwise configured `XDG_CONFIG_HOME/zed`.
  Initial fixtures were placed in the wrong directory, so no recorder started
  until this was corrected.[7]
- The first launch inherited desktop-service context and displayed a
  wallet-creation prompt. It was stopped without completing wallet/account
  setup. The native qualification used a subsequent launch with a minimal
  environment and a private non-activating D-Bus session; no credentials were
  entered.
- Default extension/server discovery occurred before the corrected private
  settings took effect. Downloaded probe dependencies stayed in private editor
  data, outside the Lensmap repository. Disable unwanted discovery and configure
  the correct private settings location **before** launching future probes.
- Tasks used `save: none`, `reveal: never`, and `focus: false`; disk
  preservation was explicitly asserted rather than assumed from task defaults.
  The pinned task implementation has distinct save strategies.[8]
- Task metadata was passed to the recorder through explicit environment fields,
  not interpolated selected source as shell syntax.
- UI automation must wait for the command/quick-open field to exist before
  typing. One quick-open timing attempt replaced selected text in the disposable
  unsaved Rust buffer before the palette acquired focus. That happened after the
  recorded revision cases; it affected no disk fixture or real workspace and was
  not counted as an integration result.

The private raw artifacts were retained under
`/home/ensu/.hermes/cache/scratch/lensmap-zed-probe-sx0p_vg_/`:
`native-results.json`, `association-results.json`, `reveal-results.json`,
`lsp-events.jsonl`, `task-events.jsonl`, pinned source, and screenshots. These
scratch artifacts may be pruned; the measured outcomes and exact source pin
above are the durable record. The disposable recorder is not a maintained
Lensmap package.

## Sources

[1] <https://zed.dev/docs/tasks>
[2] <https://zed.dev/docs/extensions/developing-extensions>
[4] <https://github.com/zed-industries/zed/blob/c84af5b99cbc366d675064e52b23664a015b6e35/crates/extension_api/src/extension_api.rs>
[5] <https://github.com/zed-industries/zed/blob/c84af5b99cbc366d675064e52b23664a015b6e35/crates/project/src/lsp_store.rs>
[6] <https://github.com/zed-industries/zed/blob/c84af5b99cbc366d675064e52b23664a015b6e35/docs/src/configuring-languages.md>
[7] <https://github.com/zed-industries/zed/blob/c84af5b99cbc366d675064e52b23664a015b6e35/crates/paths/src/paths.rs>
[8] <https://github.com/zed-industries/zed/blob/c84af5b99cbc366d675064e52b23664a015b6e35/crates/workspace/src/tasks.rs>
[9] <https://github.com/zed-industries/zed/issues/21208>
[18] <https://github.com/zed-industries/zed/blob/c84af5b99cbc366d675064e52b23664a015b6e35/crates/editor/src/editor.rs>
[19] <https://github.com/zed-industries/zed/blob/c84af5b99cbc366d675064e52b23664a015b6e35/crates/editor/src/selection.rs>
