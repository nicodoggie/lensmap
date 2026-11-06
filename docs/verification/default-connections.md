# Default connections qualification

## Scope

This record covers the implemented [default connection contract](../default-connections.md), not custom vocabularies, publication, a desktop application or expanded filesystem access. The authoring format remains experimental `version: v1`.

## Automated evidence

The final production-source candidate passed:

- `pnpm check`: release tests, Biome, script TypeScript checking, workspace unit tests, typechecks and builds. The owning suites reported 22 document tests, 67 web tests, 5 language-server tests and 13 release tests.
- `pnpm test:e2e`: 35 Chromium cases against built application assets, with no failures or skips.
- Native Zod-to-JSON-Schema export and existing Zod/Ajv parity cases; the generated schema is formatted with the repository's Biome tooling.

The checks retain seven pre-existing informational template-literal suggestions in server tests and the existing Vite chunk-size warning. Neither was suppressed. Desktop and narrow screenshots were inspected; synthetic interaction tests do not prove physical comfort or universal large-graph legibility.

Focused RED/GREEN cases cover typed metadata propagation, field-located validation errors, unsafe host opening, copied thought links, pending-load supersession, locationless missing-anchor recovery, overlapping parallel routes/loops, continuation hover/panning and redirected resource bases. The redirect fixture uses a real loopback HTTP redirect and normal browser CORS rather than replacing the fetch implementation. It also verifies that reaching a previously edited map through a new redirect alias preserves both its applied source and unapplied draft; canonical cached work is rechecked after redirect resolution.

An independent specification review found overlapping parallel routes and missing continuation hover inspection. Both were reproduced, corrected and exercised through real pointer hit testing. A separate security/quality review approved the attached-resource authority boundary and found the redirect-base error, which also received a reproduced correction. Its proposed Back/Forward/hash race did not reproduce in either the matching-anchor or absent-anchor browser case; both probes remain in the regression suite. Do not describe that static concern as a witnessed failure.

## Native editor evidence

The isolated Zed 1.27.0 run exercised the unchanged host transport and document-analysis boundary:

- The real editor advertised `window.showDocument` support.
- An authenticated request selected a current attached external portal by URI, revision, attachment and thought key. The server derived its relative file destination and sent `window/showDocument` with `external: false` and `takeFocus: true`.
- The real editor returned success and visibly opened the intended text file containing a synthetic sentinel. This was checked in a native screenshot, not inferred from the acknowledgment alone.
- Two synthetic maps were attached. Direct authenticated loading returned an unsaved destination thought at revision 45; an unopened local map returned HTTP 404.
- Fixture disk hashes before/after were equal. All 24 recorded probe-owned processes had stopped at parent readback. The shared Git status change during the probe was the parent's new regression test; its original 29 frozen candidate files were unchanged.

Native screenshots, sanitized protocol evidence, fixture hashes and the run report were retained locally, not embedded in source or package assets. Private bootstrap URLs/tokens and raw traffic remain outside the repository with mode `0600`.

The native run had setup/procedural deviations and is **not** offered as strict offline/process-isolation qualification. Those deviations were disclosed separately and recorded in the local report. They do not turn observed UI/readback into fabricated evidence, nor do successful UI operations erase the deviations. The parent did not reuse the deviating worker's context.

The later renderer and standalone redirect corrections were exercised in the final built-browser suite; the native editor host transport itself did not change. Native browser-choice preference permutations and native web-URL opening were not exercised. The combined browser-portal-to-native-editor click path is not claimed as one native end-to-end run: the browser suite and native transport probe establish separate boundaries.

## Current operating limits

- Standalone hosted entry uses `/?map=<encoded source URI>`, optionally including an encoded thought fragment. Copied thought links identify the source map and anchor.
- Relative links resolve from the source resource's final URL after redirects. A locationless playground draft cannot resolve relative external resources.
- Browser HTTP(S) loading obeys its normal CORS/authentication constraints. There is no credential manager, proxy, folder picker or file loader.
- The bridge loads current valid attached buffers only. Attach an unavailable map in the editor first; Lensmap does not read its saved file or silently open it to acquire access.
- Host opening requires advertised LSP support. Unsupported hosts fail visibly with HTTP 501; host refusal does not fall back to an OS opener.
- Successful navigation retains full in-session view state and unapplied drafts. Browser reload does not provide durable saving. Source history is not rolled back by Back/Forward.
- Unknown types, invalid maps, unsafe addresses and missing targets retain current work. Only an otherwise valid map with a missing thought exposes **Open destination map anyway**.

Publication and third-party host qualification remain separate work.
