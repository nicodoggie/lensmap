# Zed + browser preview (experimental)

Lensmap can now consume an attached, **unsaved `.lensmap` buffer** through a
stdio language server and serve its map from the same process over loopback.
The standalone playground still uses explicit Apply; this integration does not
add a second source editor to the preview or write saved files behind Zed.

The format and integration remain experimental. Linux/X11 with installed Zed
1.27.0 is the native acceptance target; other operating systems and editor
versions have not been qualified. This is a local development installation,
not a published extension or npm release.

**Recommended installation: use the dev-extension flow below.** Build from this
checkout and keep the server path in workspace settings. A GitHub release, an
extension-registry submission and an automatic runtime downloader are not
required. npm package preparation and an approval-gated npm release workflow are
now available; see [package/release setup](npm-release.md). This does not mean
the packages were published. The extension now supports a pinned Zed-managed npm
runtime when no binary override is supplied, and has a prepared
[source/component release flow](zed-release.md). Fresh public npm installation
is pending first publication. Keep the local override below until then; Zed
registry submission remains a separate human-led step.

## Build and configure

From this checkout, with Node 24.16+ and pnpm 12.15.0:

```sh
pnpm install --frozen-lockfile
pnpm build
node packages/language-server/dist/main.js --configure-zed --zed /usr/bin/zeditor
```

The last command **prints** settings with absolute paths for this checkout; it
does not change editor settings. Use your verified Zed executable path if it is
different. In particular, do not assume a command called `zed` is the editor.
Re-run this command after moving the checkout or changing its Node installation.

1. In Zed, run **zed: install dev extension** and select this checkout's
   `editors/zed` directory. This small Rust/Wasm extension only launches the
   configured TypeScript server; it does not render the map. Zed 1.27's development
   extension build needs Rust and the `wasm32-wasip2` target. The extension ID is
   now `lensmap-lsp`; uninstall an earlier `lensmap` dev extension before
   reinstalling to avoid duplicate launchers. Keep the `lsp.lensmap` settings key.
2. Merge the printed settings into the intended workspace's `.zed/settings.json`.
   Preserve unrelated settings and existing language servers. `.lensmap` files
   are associated with YAML; the Lensmap server ignores ordinary YAML documents.
3. Open `examples/quickstart.lensmap` or the larger `examples/night-ferry.lensmap`.
   Use Zed's language-server restart action if it was open before configuration.
4. At a source thought, open code actions and choose **Lensmap: Open preview**.
   On the qualified Linux host this launches the browser using `xdg-open`.
   Keep the server's stdout dedicated to LSP; do not launch it as a background
   web daemon in a terminal and expect it to receive the editor buffer.

The server chooses an available `127.0.0.1` port and serves the built viewer from
its package-local `dist/preview` directory. The root build orders the web assets
before the server's asset copy; `--assets PATH` remains a development override.
Rebuild after source changes, then restart the language server to load the new
server/viewer together. `pnpm dev` is the standalone playground, not the attached
IDE preview. No real user editor settings are installed automatically by this
repository's tests.

## Use the preview

- Valid unsaved edits update the map after a short analysis debounce. Surviving
  thought identities, selection, camera and zoom are retained. Prose-only edits
  reuse computed layout; topology/position changes can recompute placement.
- Pending source shows **Analyzing**. Invalid syntax/schema/references retain the
  last valid graph with a visible **stale** state and diagnostics. Current source
  navigation and edit proposals are unavailable until bindings are valid again.
- **Follow editor caret** starts off. Enable it to centre on a changed owning
  thought when Zed sends document-highlight requests, without taking editor or
  browser control focus. This is a conditional language-feature signal, not a
  universal cursor subscription; multiword selections may suppress it.
- **Lensmap: Centre preview here** is the explicit code-action fallback. Its
  captured source revision must still be current when invoked.
- **Thought details** exposes Markdown, explicit connections and **Reveal source**.
  Reveal is deliberate, not a side effect of map exploration. The server mediates
  it through the configured Zed CLI and only for attached documents. CLI columns
  use UTF-8 bytes; LSP and engine positions use zero-based UTF-16.
- Multiple attached documents are selectable. Map portals and viewer-owned
  Back/Forward retain the complete view state without overwriting newer source.
  Reopening an attachment invalidates old internal keys, even at the same URI
  and revision. Normal live updates preserve exploration.
- `map_link` resolves relative to the source buffer's URI and loads only a
  currently valid attached buffer. Open an unavailable destination in Zed first;
  Lensmap does not read arbitrary saved files or change editor focus merely to
  inspect a portal. Missing fragments retain the map and offer **Open destination
  map anyway**; whole-map entry uses Overview and targeted entry uses Lens.
- `external_link` opening is explicit and delegated through advertised LSP
  `window/showDocument`, not the OS opener used to launch the preview. Unsupported
  editors return a visible limitation. Native Zed 1.27 file opening was exercised;
  web-browser preference permutations were not. See [qualification](verification/default-connections.md).
- Closing/restarting the language server closes its HTTP endpoint. The browser
  marks itself disconnected and retains the last map; reopen from Zed after a
  restart to authorize the new session. There is no permanent daemon.

## Focused tool API

The shared runtime offers bounded reads and content edits, not a complete graph
editing CLI/MCP catalogue. An LSP client can execute `lensmap.session` to obtain
`origin`, `previewURL` and `apiToken` for the current run. These are **private
credentials**: do not paste them into issues, source control, screenshots or logs.
A separate CLI discovery/credential handoff is not implemented yet.

Tool requests use `Authorization: Bearer <apiToken>`:

- `GET /api/session`: attached document snapshots and active URI.
- `GET /api/document?uri=...`: current analysis, last-valid graph and revisions.
- `GET /api/thought?uri=...&key=...`: full thought content, incident explicit
  connections, revisions and a current definition range when available.
- `POST /api/content`: `{uri, key, baseRevision, patch}` where `patch` contains
  `summary` and/or `full_text`, each a string or null. Send `application/json`.
- `POST /api/centre`: `{uri, position: {line, character}, baseRevision}`;
  positions are zero-based UTF-16. This is a view command, not a source edit.
- `POST /api/reveal`: `{uri, key}`; host-mediated explicit source navigation.
- `POST /api/open-destination`: `{uri, key, baseRevision, attachmentId}`; open an
  external portal from current valid attached analysis. Extra URL overrides,
  stale revisions/attachments, unsafe addresses and non-external thoughts are
  rejected. The server derives the URL from source; clients cannot submit an
  arbitrary opening address. Lack of host opener support returns HTTP 501.

Keys are internal session identities, not authored IDs or stable cross-session
addresses. Read the current snapshot rather than constructing keys yourself.
Unsupported source-edit forms fail explicitly: rich flow-map field insertion,
summary promotion of a shorthand scalar, null shorthand replacement and edits
through YAML aliases are not silently rewritten. Existing block/rich fields and
supported shorthand full-text edits preserve unrelated source bytes, comments
and nested connections; changed scalar values may become JSON-quoted YAML.

Content writes check the base revision, validate the proposed document and
serialize this process's writes, then send versioned `workspace/applyEdit` to
Zed. **Zed can rebase an edit if human typing races with application. This is not
atomic compare-and-swap.** Nico accepted that limitation for this iteration.

- HTTP 200 / `confirmed`: actual live-buffer readback matched the prepared source
  (or the requested edit was already a no-op).
- HTTP 409 / `rejected`: editor rejected application. A stale/invalid base or
  missing valid analysis also returns a 409 error before application.
- HTTP 202 / `unconfirmed`: acknowledgment arrived but expected source was not
  observed within the readback window. Re-read before deciding what to do; do
  not automatically retry, assume rollback or overwrite the saved file.

Edits use native undo. There is no OT/CRDT, unattended retry, whole-workspace
file access, create/reparent/delete API, remote endpoint or credential manager.

## Security and evidence

The bridge binds only to loopback and rejects unexpected Host/Origin values.
The browser exchanges a private URL fragment for an HttpOnly, SameSite cookie
and immediately removes that fragment from its address. The tool API uses a
separate bearer token. Static serving is limited to built assets, and source
access is limited to documents opened by the attached editor. This is local
per-process authorization, not protection from a fully compromised local user.

See [verification](verification.md) for executed browser/native cases and their
limits, [the implementation plan](plans/zed-browser-integration.md) for the
milestone contract, and [the earlier host probe](zed-integration-probe.md) for
why editor acknowledgments alone are insufficient.
