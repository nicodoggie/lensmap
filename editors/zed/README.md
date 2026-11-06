# Lensmap LSP for Zed (experimental)

A language-server launcher for Lensmap's live browser preview. This extension
uses YAML highlighting and does not embed a native renderer or bundle the
language server. Extension ID: **lensmap-lsp**; language-server/settings key:
**lensmap**. Licensed under MIT; see `LICENSE` in this directory.

## Install for development

Requires Rust with the `wasm32-wasip2` target to build a dev extension. In Zed,
run **zed: install dev extension** and choose this directory. An extracted
`lensmap-lsp-<version>.tar.gz` source bundle can also be selected. Zed builds
its own Wasm from the included source; the precompiled `extension.wasm` is a
build artifact, not a separate extension-registry installation protocol.

If you installed the earlier dev extension with ID `lensmap`, uninstall that
old dev extension before installing `lensmap-lsp` to avoid duplicate launchers.
Your `lsp.lensmap` settings remain valid; do not rename that settings key.

Configure the intended workspace (merge rather than replace existing settings):

```json
{
  "file_types": { "YAML": ["lensmap"] },
  "languages": { "YAML": { "language_servers": ["lensmap", "..."] } }
}
```

With **no** `lsp.lensmap.binary` override, the launcher asks Zed's npm API for the
exact `@lensmap/language-server` version recorded in `server-version`. It reuses
that exact cached version or installs it in Zed's extension-owned work directory,
then launches it with Zed's Node and `--stdio`. No global npm install is needed.
The server includes its browser assets and npm resolves its runtime dependencies.
The launcher does not follow `latest` or `next` automatically.

**The pinned npm runtime must be published first.** Package/release preparation
alone does not make a fresh registry install work. Node **24.16+** is required;
if Zed selects an older Node, the launcher explains the requirement rather than
installing or changing your Node configuration. Native acceptance is currently
Linux/X11 only; other OS/editor versions remain unqualified. Automatic browser
launch uses `xdg-open`; source reveal currently expects a `zeditor` executable.

At an attached `.lensmap` thought, invoke **Lensmap: Open preview** through code
actions. Keep stdout reserved for LSP. Preview credentials are private per run.
See the [full setup/API documentation](https://github.com/nicodoggie/lensmap/blob/main/docs/zed-browser.md).

## Local runtime override (works before npm publication)

From a full source checkout, build with `pnpm build` and print settings:

```sh
node packages/language-server/dist/main.js --configure-zed --zed /usr/bin/zeditor
```

Merge those absolute binary settings into the intended workspace. The extension
preserves the configured command, arguments and environment and does **not**
resolve Node or install npm packages for an explicit override. An incomplete
binary override is an error, not permission to silently fall back to downloads.
Remove the entire `binary` override when deliberately switching to the managed
npm runtime. Do not remove unrelated LSP settings. Regenerate absolute paths if
you move the checkout or change its Node installation.

## Release boundaries

The source/Wasm bundle is a **dev-install artifact**, not a self-contained runtime
or a published Zed registry extension. The repository's `zed-v<extension-version>`
workflow builds/verifies artifacts and prepares a draft GitHub prerelease only
after its pinned npm version installs and passes the bridge browser tests.
Manual dispatch verifies artifacts without creating a release.

Zed registry submission is separate and human-led under upstream contribution
and AI policy. It uses the public repository as a branch-reachable submodule,
`path = "editors/zed"`, and the exact version in `extension.toml`; it does not
consume GitHub's prebuilt Wasm. No upstream PR is created by this workflow.
