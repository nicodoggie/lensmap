# Custom connection types — local qualification

## Scope and release boundary

The source checkout implements [the custom connection-type contract](../custom-connection-types.md)
across the document engine, shared viewer, language server and Astro/Starlight.
The runtime remains experimental `version: v1`. This qualification does not
publish packages, create a release or establish cross-platform/native-device
acceptance. Combined review and the bounded repair recheck are complete: the
completion finding was fixed and rechecked with SPEC and QUALITY/SECURITY PASS.
See the [implementation plan](../plans/custom-connection-types.md).

Package versions remain `0.2.1` during this development task. Locally packed
feature artifacts differ from the already-published `0.2.1` and must **not** be
published as replacements for that immutable registry version. A future release
requires its own versioning and publication authorization.

## Execution evidence

The retained local logs are under `artifacts/checkpoints/custom-types/` (ignored,
not committed). Counts below describe their individual runner scopes, not an
aggregate of distinct tests across repeated executions.

| Boundary                        | Evidence                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document engine                 | 90 owning tests passed; typecheck/build passed. Covers declaration/CSS validation, layered inheritance, exact names, destination capability, source identities and stale recovery.                                                                                                                                                       |
| Language server                 | 7 server tests passed. The added completion case applies actual edits for boolean-like, colon-containing and comment-like names, including replacement inside quotes and preservation of comments.                                                                                                                                       |
| Whole workspace                 | `pnpm check` passed again on the repaired candidate, including lint, release tooling tests, script types, owning suites, typechecks and builds.                                                                                                                                                                                          |
| Shared viewer and source bridge | `pnpm test:e2e`: 41 Playwright tests passed. Includes all marker forms, native CSS widths, transparent raster samples, zero-width hit routes, loops, parallel routes, continuations, navigation and same-source-revision metadata updates.                                                                                               |
| Isolated package consumption    | `pnpm test:packages` passed from retained local tarballs. A clean npm production install checked exact cohort dependencies, public declarations and Node project export, native Astro/Starlight builds and browser behavior, dev vocabulary reload/recovery, the runtime executable, generated Zed settings and 4 bridge browser checks. |
| Generated schemas/example       | Both owning Zod schemas exported and formatted; representative vocabulary Ajv checks passed. The shared example ran through the actual Node loader and engine.                                                                                                                                                                           |

The packed-consumer gate includes static/no-JavaScript reading and responsive
inspector behavior, not merely successful import resolution. Dev reload checks
preserve selection, camera and node positions while exercising valid edits,
invalid vocabulary, config deletion/recreation, missing vocabulary and target
changes.

## Integration corrections retained

- Portal defaults remain unmarked. Custom relation styling does not change a
  destination's resource identity or grant a new opener.
- Vocabulary diagnostics carry responsible file URIs; external errors are not
  shown at unrelated map offsets. Shared parent lookup can use map-local types.
- Completion inserts a JSON-quoted YAML scalar and replaces the actual value,
  not only an identifier word. Empty values do not consume comment separators.
- Continuation painting retains muted fading and visible-end marker semantics.
  Native comparisons inspect paint and marker content rather than old SVG IDs.
- The browser fixture restores Vite's process-wide `NODE_ENV` after building its
  test bundle, so later dev-server cases do not accidentally run production code.
- Starlight supplies native Vite dependency optimization for its document and
  Markdown dependency closure. The viewer itself is not prebundled, preserving
  its live custom-event subscription.
- The two installed native sites are declared npm workspaces of their shared
  production install. Qualification does not weaken product filesystem guards
  to compensate for an undeclared parent dependency directory.

## Native limits

Native automation here uses Linux, Node and Chromium. It does not prove physical
touch comfort, very large maps, every browser or Windows/macOS/mobile behavior.
Desktop and narrow shared-viewer images were inspected; the deliberately thick
custom fixture is a stress case, not a recommended default presentation.

The LSP honors unsaved config/vocabulary buffers only when a client forwards
them. Generated Zed YAML associations include `.lenstypes`, but do not claim
unrelated JSON files or establish that Zed forwards an unsaved JSON config.
Saved-file reload and forwarded-buffer precedence are separately exercised.
This task does not claim a new interactive native Zed GUI acceptance run.

The standalone browser cannot discover sibling files on the author's disk.
Use inline declarations there, or supply vocabulary through an authorized host.
MDX/executable-content admission, runtime remote-map Markdown policy, portal
permissions and source-relative resource behavior remain unchanged.
