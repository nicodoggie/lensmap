# Zed extension release preparation

## Goal and authority

Nico authorized pushing the npm checkpoint and preparing the Zed extension
release flow. npm trust/account setup is explicitly deferred. Do not publish
packages, create release tags/releases or submit upstream registry PRs now.
Continue the npm-first distribution direction rather than create a second
server/dependency archive format.

## Contract

- Preserve `lsp.lensmap.binary` path/arguments/environment exactly when supplied;
  malformed explicit overrides fail rather than silently switching runtimes.
- Without an override, use Zed's supported Node/npm APIs in its extension-owned
  work directory to install the exact server version recorded in
  `editors/zed/server-version`. Reuse an exact cached version; propagate install
  failures with an actionable message. Do not query mutable `latest`/`next`.
- Check the selected Node against the server's Node 24.16+ requirement before
  installation. Do not change a user's runtime or global npm configuration.
- Use extension ID `lensmap-lsp` to reflect a language-server-only extension,
  retaining language-server/settings key `lensmap`. Start extension/Cargo version
  at 0.1.0; version the runtime pin independently for later extension-only fixes.
- Generate a dev-install source archive with its MIT license, locked Cargo
  manifest/source, README, runtime pin and compiled Wasm. Do not include the
  server inside the extension. Extract/build that source archive as qualification.
- Prepare a `zed-v…` workflow: manual dispatch builds/verifies artifacts only;
  matching tags additionally require the exact npm server version to exist and
  install with production dependencies before creating a draft prerelease.
  Publish no Zed registry entry and configure no trust/credentials.

## Implementation and evidence

1. Focused Rust RED/GREEN for override precedence, exact-version installation
   policy and Node minimum handling. Keep native Zed API calls direct; introduce
   no generic plugin/host framework. Cargo fmt/test/clippy and locked Wasm build
   validate the Rust/manifest boundary.
2. Native archive/build/extension-manifest verification, workflow actionlint and
   a real extracted-artifact build rather than string-based workflow tests.
3. Exercise the Wasm launcher in a disposable native Zed profile with a real
   tarball-installed cached runtime. Preserve the live user editor. Confirm
   unsaved buffer analysis/preview readiness and owned-process cleanup. This is
   cached-launch proof, not a fresh public npm download; that final acceptance
   remains blocked on explicitly deferred first publication.
4. Document tag order, install/configuration, extension-ID migration, draft versus
   registry release and human-led upstream policy. Review and make a verified
   local milestone commit; push the approved release-preparation work and read
   back the exact remote head. No tags or release creation in this turn.

## Policy sources

Revalidated Zed publishing prerequisites, guide, maintenance and license rules at
`zed-industries/zed` revision `4a6121bb0f10c6e8037b741b7dc0a4cd639ae289`, and
`zed-industries/extensions` contribution/AI policy. Registry submission requires
manual exact-revision testing, an appropriate LSP ID, an extension-local license,
a public HTTPS branch-reachable monorepo submodule/path entry and human-owned
submission/explanation. GitHub draft artifacts are not registry admission.
