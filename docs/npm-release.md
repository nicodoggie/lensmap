# npm package preparation and releases

## Current state

The local package/install path is qualified for `@lensmap/document` and
`@lensmap/language-server`, initially at **0.1.0**. Both are experimental public
packages, using the **next** dist-tag rather than claiming a stable `latest`
release. This preparation does not mean either package has been published.
The `@lensmap` organization belongs to Nico; owning the scope does not create
package records or configure trusted publishing.

- **document** contains compiled ESM and TypeScript declarations for the root
  and `/v1` exports. It owns analysis/source semantics, not a renderer.
- **language-server** contains compiled ESM, declarations, the `lensmap-lsp`
  executable and package-local built browser assets. Its dependency on document
  is rewritten from `workspace:*` to the exact package version by `pnpm pack`.
- Both tarballs include their package README and the workspace's MIT license,
  using pnpm's native packing rules. Explicit `files` lists keep source tests,
  dependency trees and caches out. The standalone web workspace stays private;
  its compiled assets are included in the server's distribution closure.

## Pack and qualify locally

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm exec playwright install chromium
pnpm test:packages
```

`test:packages` builds, packs to ignored `artifacts/npm/`, installs both real
`.tgz` files in a disposable directory outside the workspace with production
packages only and lifecycle scripts disabled, then consumes the exports and
executable there. A consumer TypeScript probe checks the installed declarations
using the checkout's test compiler/Node types, not dev dependencies added to the
production install. The three existing bridge browser tests run against that
installed server without `--assets` or a checkout preview server. They exercise
live edits, last-valid retention, source reveal through a synthetic host,
confirmed content-edit readback, attachment replacement and shutdown.
Private session URLs/tokens are not retained in Playwright traces. Temporary
consumer installs are removed on completion/failure; tarballs stay for inspection.

`pnpm pack:packages` builds and packs without running install/browser acceptance.
Direct `pnpm --filter @lensmap/language-server pack` also builds the web/server
closure through its prepack hook. `pnpm build` now orders document → web → server;
the server copies the built viewer into `dist/preview` and resolves it relative
to its installed executable, not a monorepo path. Explicit `--assets PATH` is
still supported. Build the server through the root Turbo graph, not its `tsc`
command alone.

## Release workflow (prepared, not remotely exercised)

`.github/workflows/npm-release.yml` has two entry points:

- **Run workflow** performs checks and package acceptance, then retains tarballs
  as `npm-packages`. Manual dispatch never publishes, even if run on a tag.
- A pushed **npm-v0.1.0** tag (or later matching version) performs the same checks,
  then waits on the GitHub **npm** environment before publication. Both manifests
  must have the same version and the tag must match it. Set required reviewers
  and restrict permitted release tags on that environment **before using it**;
  the YAML environment name alone does not establish human approval protection.

The publish job downloads the same verified tarballs, does not rebuild them,
and publishes **document first, then language-server**, explicitly public and
with `next`. It reads back each exact version from the registry. GitHub's native
artifact digest validation protects transfer. Publication jobs are serialized;
no PR-triggered job receives publishing authority. Actions are pinned to their
verified release commits.

The workflow uses GitHub-hosted Ubuntu, Node 24 and npm 11.20.0. npm trusted
publishing needs npm 11.5.1+ and Node 22.14+. Only the publish job receives
`id-token: write`; no long-lived npm token is required or added. Public GitHub
repository/package OIDC publishing generates provenance automatically. See
[npm's trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).

### First publication and account setup

These are separate, explicitly authorized external operations, not performed by
local package tests or by creating this workflow:

1. Review the exact tarballs and approve publication. If package records do not
   exist yet, bootstrap with an authorized npm account and its normal interactive
   login/2FA, publishing document before server. Use the packed artifacts, public
   access and `next`; never commit a credential or paste one into chat. npm's
   [trust CLI documentation](https://docs.npmjs.com/cli/v12/commands/npm-trust/)
   requires an existing package for trust configuration.
2. Configure a trusted publisher for **each** package: GitHub owner `nicodoggie`,
   repository `lensmap`, workflow filename **npm-release.yml**, environment
   **npm**, with direct publish permission. Follow npm's validation deadline for
   a newly configured publisher. Configure the GitHub environment's required
   approval separately; no account settings are installed by this repository.
3. For subsequent releases, update both package versions, run the checks, commit,
   and only with push/publication authorization create/push the matching `npm-v…`
   tag. Do not tag an already bootstrapped version and expect it to republish.
4. After a release, install the exact server version from npm in a clean consumer
   and exercise the editor path before calling Zed distribution qualified. Local
   paired-tarball installation does not prove registry dependency availability.

npm publication is not transactional across packages. If document publishes but
server fails, keep the successful engine release. Inspect the failure and finish
publishing the **same verified server tarball** after approval; blindly rerunning
the complete publish job will encounter the immutable already-published engine
version. Do not silently skip duplicate versions or publish rebuilt bytes under
an existing version.

## Consumption after publication

```sh
npm install --global @lensmap/language-server@next
lensmap-lsp --configure-zed --zed /usr/bin/zeditor
```

Use a verified host executable path. Merge the printed settings into the intended
workspace and keep the separately installed Zed dev extension; the npm package
neither modifies settings nor registers an editor extension. The Node/package
paths must remain installed. Zed's npm downloader/release flow and registry
submission are a later integration milestone. See [Zed setup](zed-browser.md).
