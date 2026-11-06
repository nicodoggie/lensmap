# Zed extension releases (experimental)

## What is ready

The extension now supports two launch paths:

- An explicit **`lsp.lensmap.binary` override** preserves the configured command,
  arguments and environment. It performs no managed Node lookup or npm install.
- Without that override, **Zed-managed npm installation** selects Zed's Node,
  checks Node 24.16+, and reuses or installs the exact
  `@lensmap/language-server` version in `editors/zed/server-version`. The process
  starts with `--stdio` and uses its bundled preview assets. No global npm
  installation or separately packed runtime archive is needed.

The extension ID is now **lensmap-lsp**, reflecting a language-server extension.
The language-server/settings key is still **lensmap**. Uninstall the earlier
`lensmap` dev extension before installing the renamed one; preserve existing
`lsp.lensmap` settings. See the [extension README](../editors/zed/README.md) and
[Zed/browser setup](zed-browser.md).

**The extension has not been submitted to the Zed registry.** Its pinned npm
runtime is now **0.1.1**, published and qualified through a fresh registry-only
production install/browser check. The extension version remains **0.1.0**;
runtime and extension versions are independent. The checkout-local binary
override remains available for development.

## Build and verify the extension bundle

Build prerequisites: the pinned Node/pnpm workspace environment, Rust with
**wasm32-wasip2**, Python 3.12+ and native `tar`/`sha256sum`. Python's standard
TOML parser and safe tar extraction are used; no custom TOML or archive parser is
maintained. Current Linux/X11 acceptance used Zed **1.27.0**.

```sh
pnpm install --frozen-lockfile
rustup target add wasm32-wasip2
cargo fmt --manifest-path editors/zed/Cargo.toml --check
cargo test --locked --manifest-path editors/zed/Cargo.toml
cargo clippy --locked --manifest-path editors/zed/Cargo.toml --all-targets -- -D warnings
pnpm test:zed-package
```

The command builds, packages, safely extracts and recompiles the actual source
archive outside the checkout. It produces ignored files:

- `artifacts/zed/lensmap-lsp-0.1.0.tar.gz`
- `artifacts/zed/SHA256SUMS`

The archive contains source, locked Cargo metadata, extension manifest,
package-local MIT license bytes, README, runtime pin and a compiled
**WASI preview2 component** named `extension.wasm`. It contains no server,
`node_modules`, build tree or private probe state. `pack:zed` creates the bundle
without extracted-source acceptance. `--tag zed-v0.1.0` additionally checks that
the supplied tag matches the manifest/Cargo version.

The preview2 target follows the installed Zed release's extension builder.
A successful `wasm32-wasip1` core-module build is **not** a loadable component for
that host. The native launcher acceptance caught that distinction. The archive
also dereferences the extension license symlink so extraction never depends on a
checkout-absolute license path.

To use the source bundle, extract it and select its directory through **zed:
install dev extension**. Zed builds its own component. The included component is
an inspected build artifact, not an alternate extension-registry installer.

## GitHub workflow

`.github/workflows/zed-release.yml` supports:

- **Manual dispatch:** Rust checks, script lint/typechecking, component build,
  safe extraction/rebuild and checksum verification, then a retained
  `zed-extension` workflow artifact. It creates no release and does not require
  an npm runtime download.
- **A pushed `zed-v<extension-version>` tag:** the same checks, plus exact npm
  version availability, a clean production installation of the published server
  and the existing four browser bridge tests against that installed executable.
  Only after those pass does a separate job create a **draft GitHub prerelease**
  with the verified bundle/checksums and read back its release metadata.

The runtime pin is independent of the extension version: an extension-only fix
can continue using the same immutable npm runtime. Do not follow a mutable npm
dist-tag from the launcher. Release publication jobs are serialized. Only the
draft-creation job receives `contents: write`, through the scoped GitHub workflow
token; no npm token, npm trusted-publisher change or new long-lived secret is
needed for this Zed flow.

The intended order is **publish/qualify npm runtime → qualify the extension in
Zed → push an explicitly authorized matching Zed tag → review the draft**.
Creating a source tag is not npm publication. A tag whose runtime is unavailable
must fail before a draft release can be created; manual artifact builds remain
usable for preparation. A failed or existing release is not silently overwritten.

## Native evidence and remaining acceptance

The real packaged component was loaded by an isolated installed Zed 1.27.0 on
Linux/X11, with its npm work directory preseeded by installing the actual local
production tarballs. There was **no LSP binary override**. A transparent Node
probe relay forwarded the real editor/server messages and injected only an LSP
session-discovery request; it did not synthesize initialization, source changes
or graph results. Native typing changed the analyzed thought to
`Cached runtime edited`, while the saved fixture stayed unchanged. Package-local
preview HTML served successfully. The owned service/cgroup and LSP endpoint
closed afterward; the existing user editor/settings were not changed.

This proves the packaged component and exact cached-runtime path, **not a fresh
public npm download through Zed**. Public npm installation/browser checks have
passed for runtime 0.1.1, but do not replace that native host qualification.
The tagged workflow adds registry-only install/browser proof, but does not
replace final native Zed acceptance of the precise submission revision. No
cross-platform host/browser-opening qualification is implied.

The manifest declares only the selected Node's fixed `--version` process probe
(the executable path is host-selected and therefore variable) and npm install
of `@lensmap/language-server`. User-restricted extension capabilities can still
reject these operations. No general shell/download permission is requested.

## Zed registry remains a separate human-led step

Current upstream prerequisites require a manually tested, branch-reachable
source revision, a public HTTPS submodule, an appropriate extension ID and an
accepted license in the extension directory. A future registry entry would use:

```toml
[lensmap-lsp]
submodule = "extensions/lensmap-lsp"
path = "editors/zed"
version = "0.1.0"
```

This is preparation, not a submitted entry. The responsible human must create
and explain the upstream PR in their own words, run the registry's native
`pnpm sort-extensions`, and handle maintainer discussion under its AI policy.
The workflow does not fork, create or update an upstream PR. Once admitted, Zed
builds the source revision itself; uploading Wasm to GitHub is not registry
publication.

Sources: [prerequisites](https://zed.dev/docs/extensions/publishing/prerequisites),
[publishing guide](https://zed.dev/docs/extensions/publishing/publishing-guide),
[capabilities](https://zed.dev/docs/extensions/capabilities), and the registry's
[AI policy](https://github.com/zed-industries/extensions/blob/main/AI_POLICY.md).
See [npm releases](npm-release.md) for runtime publication and trusted-publisher setup.
