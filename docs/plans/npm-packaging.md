# npm packaging implementation plan

## Approved boundary

Prepare `@lensmap/document` and `@lensmap/language-server` under Nico's npm
organization. Keep the playground private. The server package includes the built
browser preview and installs its runtime dependencies through npm; it never
fetches dependencies at startup. Zed's dev-extension override remains supported.
No registry publication, account changes, pushes or Zed registry submission are
part of this local milestone.

## Implementation

1. Add one package-consumption seam to the existing browser bridge tests, allowing
   them to launch an installed server without checkout asset overrides. Exercise
   it before implementation to expose the missing package-local asset default.
2. Prepare public ESM manifests at initial experimental version `0.1.0`, with
   explicit files/exports/bin/engines, MIT licenses and package-specific READMEs.
   Keep document engine imports unchanged and workspace dependencies native.
3. Build the server after the web build and copy the built assets into its `dist`
   closure. Resolve the default preview relative to the installed server, while
   preserving explicit `--assets`. Include the copying script in Turbo inputs.
4. Add native build/pack and disposable install verification commands. Pack real
   tarballs, install both together with production dependencies outside the
   workspace, import public exports and run the existing browser bridge suite
   through that installed binary. Keep private session credentials out of traces
   and command output. Use manifests and native npm/pnpm proof, not string tests.
5. Prepare a gated GitHub Actions npm release workflow: verify/pack/install first,
   retain tarballs, then publish document before server from the verified artifact
   through an explicitly approved `npm` environment using trusted publishing.
   Describe first-publication bootstrap and trusted-publisher setup separately;
   neither is performed here. Zed distribution follows a qualified npm install.
6. Run `pnpm check`, isolated package acceptance, workflow lint and diff review.
   Make one local milestone commit after review. Report unexercised remote
   publication honestly.

## Acceptance and stop condition

A clean production installation can start LSP, analyze live unsaved content,
serve all real browser assets, synchronize edits and shut down through the
existing bridge tests. Native packing demonstrates exports, runtime dependency
rewriting and license inclusion. Checks and workflow lint pass. This does not
claim npm publication, real Zed installation from npm or cross-platform host
qualification.
