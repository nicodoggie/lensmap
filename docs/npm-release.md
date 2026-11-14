# npm package preparation and releases

## 0.4.0 release candidate

Nico authorized releasing the four-package cohort as **0.4.0** directly to
**latest**. Versioned qualification and registry publication are in progress;
this heading does not claim public availability. See
[the 0.4.0 notes](releases/0.4.0.md) for default node styles, responsive styling,
world-coordinate positioning, diagnostic/auto-sizing fixes and upgrade pins.
Use the established qualified local-tarball path; do not push an `npm-v*` tag
to start a second publisher. The unrelated shape/layout draft is excluded.

## Published presentation/vocabulary cohort (0.3.0)

`@lensmap/document`, `@lensmap/language-server`, `@lensmap/astro-loader` and
`@lensmap/starlight` are published at **0.3.0**, with **latest** pointing to that
version for all four packages. Publication and anonymous registry-only
consumption were verified on **2026-11-10**. The qualified source is
`d822cca7074846067ec9f2f16cccb163be228b56`, fast-forwarded and pushed to `main`.
See [0.3.0 release notes](releases/0.3.0.md) for custom connection vocabularies,
CSS node styling, measured sizing, upgrade guidance and limits.

Native `pnpm test:packages` qualified the versioned four-package tarballs before
publication. The registry's package versions, exact cohort dependencies,
`latest` tags and SHA512 integrities matched those retained artifacts; all four
publicly downloaded archives matched the qualified bytes exactly. The runtime
packages' historical `next: 0.1.1` tags were left unchanged.

A fresh anonymous, registry-only production install passed public exports,
custom connection/node-style analysis, native Astro rendering and denied-source
checks, Starlight production/no-JavaScript/responsive reading and live-dev
vocabulary reload, installed CLI/generated settings and all four installed-server
Chromium bridge tests. No local tarball paths or workspace aliases supplied the
installed packages. Desktop/mobile captures were inspected. The disposable
consumer was removed. This does not qualify a new Zed extension or its managed
runtime download; that separately pinned extension was not changed.

The release used the qualified archives through native npm staging, not directory
publication or a rebuild. Nico completed human publication approvals; the
waiting CLI approval was stopped when he published the remaining stages.
No publication was retried. Local/registry stage-download checks retained exact
artifact identity. No OIDC/trust settings were changed, and no `npm-v0.3.0` tag
was pushed to start a second automatic publisher.

Ignored evidence is retained under `artifacts/npm/release-0.3.0-latest/`:
`manifest.json` binds source and original tarballs, `verified-stages.json` records
downloaded staged-byte identity, `qualification.log` records packed-consumer
acceptance, and `registry-consumption.json` plus `registry-qualification.log`
record public registry identity and actual anonymous consumer checks. Qualified,
staged-download and registry-download tarballs and native consumer screenshots
remain alongside those receipts.

## Earlier Astro cohort (0.2.1)

`@lensmap/document`, `@lensmap/language-server`, `@lensmap/astro-loader` and
`@lensmap/starlight` were published at **0.2.1**, with **latest** pointing to that
version for all four packages at the time. They remain experimental packages.
Publication and registry-only consumption were verified on **2026-11-07** against
retained tarballs from source commit `ba247954d3b8a20dc740229fca2bbbcefa7a7f85`.
See the [shipping plan](plans/2026-11-07-astro-packages.md) for the original scope.

The public registry's package identities, versions, dependencies and SHA512
integrities matched the qualified artifacts; all four downloaded tarballs
matched the retained bytes exactly. A fresh anonymous, registry-only production
install passed public exports, native Astro rendering/MDX/assets, native
Starlight responsive and no-JavaScript reading, the installed CLI/generated
settings, and all four installed-server browser bridge tests. No workspace
aliases were consumed. This is not fresh native Zed managed-download acceptance.

Local ignored evidence is retained under `artifacts/npm/release-0.2.1-latest/`:
`manifest.json` identifies the source and original tarballs,
`registry-consumption.json` records the public-registry result, and
`registry-qualification.log` contains the actual install/native/browser output.
Downloaded registry tarballs and consumer screenshots are retained alongside
those receipts. Pre-publication packed-consumer qualification is recorded in
`artifacts/checkpoints/latest-0.2.1/qualification.log`.

Publish directly to **latest**. Nico selected this simpler release policy: no
`next` staging channel or separate promotion step for routine releases. This
release used qualified pnpm tarballs, native npm staging and human approval;
it does not establish OIDC publication for the new Astro package names. Their
trusted-publisher configuration still needs separate setup/qualification; the
existing runtime packages' OIDC configuration does not authorize a newly named
package. Do not push `npm-v0.2.1` to replay an already completed publication.
No credentials or account settings are installed by the package checks.

**Stage only the qualified tarballs, never workspace directories.** `npm stage
publish` is npm's native deferred-approval mechanism, not the `next` dist-tag.
Stage the corresponding retained tarball for each package, then approve those
stages:

```sh
npm stage publish artifacts/npm/lensmap-astro-loader-0.2.1.tgz \
  --access public --tag latest --registry=https://registry.npmjs.org/
```

`pnpm pack` rewrites `workspace:*` dependencies to exact release versions inside
the tarball while leaving development manifests unchanged. npm does not
automatically reuse an existing `.tgz`: pass its path explicitly to `npm publish`
or `npm stage publish`. A bare npm publication repacks the source directory and
bypasses pnpm's rewriting. The approved Astro/Starlight 0.2.0 directory stages
retained `workspace:*`; 0.2.1 replaces them with correctly packed dependencies.
Already-published versions are not overwritten.

## Earlier runtime-only release (0.1.1)

`@lensmap/document` and `@lensmap/language-server` were published at **0.1.1**,
with both **next** and **latest** pointing to that version at the time.
Downloaded registry tarballs matched the retained
CI-verified bytes, including the qualified TypeScript declarations.
OIDC publication and OIDC dist-tag promotion are now exercised for both packages.
The immutable source tag is `npm-v0.1.1` at
`47b31d1c25c5ac54fef2ecac593158cf73b422d5`.

The [tagged run](https://github.com/nicodoggie/lensmap/actions/runs/42238420160)
verified both artifacts and published the engine, but its immediate registry
readback hit npm's processing delay and stopped before attempting the server.
[Server-only recovery](https://github.com/nicodoggie/lensmap/actions/runs/42240606663)
reused those verified artifacts without rebuilding or republishing the engine.
[Latest promotion](https://github.com/nicodoggie/lensmap/actions/runs/42241063129)
then succeeded. Registry SHA512 integrity and downloaded bytes matched the
original CI tarballs for both packages. A registry-only production install passed
exports, exact engine dependency, CLI, generated settings and all four browser
bridge tests. This is not fresh native Zed managed-download acceptance.

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

`test:packages` builds, packs to ignored `artifacts/npm/`, installs all four real
`.tgz` files in a disposable directory outside the workspace with production
packages only and lifecycle scripts disabled, checks exact intra-cohort
dependencies/export resolution, then consumes the runtime exports and
executable there. A consumer TypeScript probe checks the installed runtime declarations
using the checkout's test compiler/Node types, not dev dependencies added to the
production install. The four existing bridge browser tests run against that
installed server without `--assets` or a checkout preview server. They exercise
live edits, last-valid retention, source reveal through a synthetic host,
confirmed content-edit readback, attachment replacement and shutdown.
Private session URLs/tokens are not retained in Playwright traces. Temporary
consumer installs are removed on completion/failure; tarballs stay for inspection.
The same command also copies the synthetic Astro/Starlight source fixtures into
independent host applications with explicit dependency manifests, resolves the
installed Astro CLI there, and exercises the actual packed integrations. It
checks admitted/denied MDX, metadata/defaults, source-relative assets, native
rendering and the responsive/no-JavaScript Starlight browser behavior. Host
dependencies are derived from the packages' peer declarations; workspace
self-reference/symlink behavior is not package qualification. Screenshots are
retained under `artifacts/npm/consumer-evidence/`. Export resolution alone would
not establish this native framework behavior.

`pnpm pack:packages` builds and packs without running install/browser acceptance.
Direct `pnpm --filter @lensmap/language-server pack` also builds the web/server
closure through its prepack hook. `pnpm build` now orders document → web → server;
the server copies the built viewer into `dist/preview` and resolves it relative
to its installed executable, not a monorepo path. Explicit `--assets PATH` is
still supported. Build the server through the root Turbo graph, not its `tsc`
command alone.

## Release workflow

`.github/workflows/npm-release.yml` separates publishing from promotion:

- **Push an `npm-v…` tag:** checks and package acceptance run first, retaining
  tarballs as `npm-packages`. All four manifests must have the same version, and
  the tag must match it. The publish job downloads those same verified artifacts
  without rebuilding, then publishes
  **document → language-server → astro-loader → starlight**,
  explicitly public and with **latest**. Routine releases need no separate
  promotion; historical tags are left alone unless an explicit operation changes
  them.
- After each accepted publish, read-only readiness checks tolerate npm's
  processing delay and require the registry integrity to match the verified
  tarball. They retry missing-version reads, never the publication itself.
- **Run workflow, neither promotion nor server recovery selected:** performs the
  same verification and retains tarballs, but never publishes or changes tags.
  The checkbox defaults to off; the version input is ignored in this mode.
- **Run workflow, Update latest checked:** enter an exact already-published
  version such as `0.1.0`. Run from `main` with the current workflow/helper; the
  target version need not match the checkout's manifests. Only the promotion
  job runs: no application build, package installation, packing or publication.
  It checks both package identities/versions and the server's exact engine
  dependency before changing either tag. It moves **latest** for both packages,
  preserves **next**, and reads both tags back. Already-matching latest tags
  require no write. An older published version can be selected for rollback.
  Select **include_astro** explicitly to promote all four packages instead;
  preflight then checks every package and exact intra-cohort dependency before
  any tag mutation. Leaving it off preserves historical runtime-only promotion
  and rollback, without inventing Astro versions for old releases.

Publishing and promotion share the GitHub **npm** environment and the same
workflow-wide concurrency group. They are serialized, and no PR-triggered job
receives registry-write authority. Actions are pinned to verified release
commits. GitHub's native artifact digest validation protects publish transfer.

**The environment name is not an approval gate by itself.** At the latest check,
`npm` had no protection rules or deployment-ref restrictions. Configure required
reviewers and allowed refs separately. Permit `npm-v*` tags for publication and
`main` for manual promotion. A solo maintainer who approves their own runs must
leave prevention of self-review disabled. This repository does not install
those account settings.

Registry-write jobs use GitHub-hosted Ubuntu, Node 24 and pinned npm **11.21.0**.
OIDC dist-tag support requires npm 11.21.0+ on the 11.x line (or 12.2.0+);
the previous npm 11.20.0 publish client was insufficient for promotion. Only the
publish, recovery and promote jobs receive `id-token: write`; no long-lived npm
token is required or added. Public GitHub repository/package OIDC publication
generates provenance automatically. Promotion only changes tags and does not
regenerate package bytes or provenance. See
[npm's trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).

### Local promotion verification and recovery

```sh
pnpm test:release
node scripts/npm-promote.ts --version 0.1.0 --dry-run
# Full cohort, only after all four exact artifacts are published and qualified:
node scripts/npm-promote.ts --version 0.2.0 --include-astro --dry-run
```

The dry run reads actual public-registry prerequisites and reports previous
tags without modifying them. Focused tests exercise promotion, preflight
failures, dry runs, partial writes and readback. `pnpm check` includes them.
Versions must be exact: ranges, tags, a `v` prefix and whitespace-modified inputs
are rejected without normalization. Registry readback retries are bounded;
mutations are never automatically retried.

Dist-tag updates are **not transactional across packages**. If a later
update fails, earlier updates may already be live. The job reports completed writes
and the previous tag snapshots; it does not attempt an automatic rollback.
Inspect the actual tags of every selected package before rerunning or selecting
the previous version.
Rerunning the same promotion skips already-matching tags. A readback mismatch
or concurrent `next` change fails rather than claiming a complete promotion.

### First publication and account setup

These are separate, explicitly authorized external operations, not performed by
local package tests or by creating this workflow:

1. Review the exact tarballs and approve publication. If package records do not
   exist yet, bootstrap with an authorized npm account and its normal interactive
   login/2FA, publishing in dependency order (document, server, Astro loader,
   Starlight). Use the packed artifacts, public
   access and `latest`; never commit a credential or paste one into chat. npm's
   [trust CLI documentation](https://docs.npmjs.com/cli/v12/commands/npm-trust/)
   requires an existing package for trust configuration.
2. Configure a trusted publisher for **each** package: GitHub owner `nicodoggie`,
   repository `lensmap`, workflow filename **npm-release.yml**, environment
   **npm**, with **Allow npm publish** for tagged releases and the independent
   **Allow npm dist-tag** permission for manual promotion. Newly created
   configurations currently require their first successful publish within two
   days; promotion of an existing version is not proof of that publish
   validation. Configure the GitHub environment's required approval separately;
   no account settings are installed by this repository. The original tagged
   `0.1.0` run verified artifacts but failed publication with `ENEEDAUTH`;
   subsequent authorized local publication completed the bootstrap.
3. For subsequent cohort releases, update all four package versions, run the
   checks, commit, and only with push/publication authorization create/push the
   matching `npm-v…` tag. Do not tag an already bootstrapped version and expect
   it to republish.
4. After a release, install the exact server version from npm in a clean consumer
   and exercise the editor path before calling Zed distribution qualified. Local
   paired-tarball installation does not prove registry dependency availability.

npm publication is not transactional across packages. If document publishes but
server fails, keep the successful engine release. Inspect the failure and finish
publishing the **same verified server tarball** after approval; blindly rerunning
the complete publish job will encounter the immutable already-published engine
version. Do not silently skip duplicate versions or publish rebuilt bytes under
an existing version.

### Server-only recovery

If the engine publish was accepted but the workflow stopped **before attempting
the server**, run the current workflow from `main` with `resume_server=true`,
`update_latest=false`, the exact `version`, and the original tagged
`verified_run` ID. The run must belong to this release workflow, match the
`npm-v<version>` tag's source commit, and contain a successful `verify` job.

Recovery downloads that run's retained `npm-packages` artifact without rebuilding.
It first confirms the engine's registry integrity against its retained tarball;
it never republishes the engine. It publishes only the missing server, then waits
for matching registry integrity. An already-visible server is verified against
the same tarball instead of being published again. Other registry errors fail
without a write. Promotion is a subsequent, separate operation.

Do not start or repeat recovery merely because an accepted server publish is
still processing. Reconcile the prior operation and wait for visibility first.
An expired/missing CI artifact is a blocker, not permission to rebuild an
immutable version. Local readiness inspection is read-only:

```sh
node scripts/npm-wait.ts PATH_TO_VERIFIED_TARBALL --version 0.1.1
```

### Four-package recovery

For an interrupted Astro cohort release, first reconcile accepted/in-flight
publishes and wait for their registry visibility. Then select `resume_cohort=true`,
`resume_server=false`, `update_latest=false`, the exact `version` and original
tagged `verified_run`. This uses the same original-run/verified-artifact checks
as server-only recovery. The accepted engine must match its retained tarball;
the remaining retained server, loader and Starlight artifacts are handled in
dependency order. An already-visible matching artifact is verified rather than
published again. Missing retained files block recovery before dependent writes.

`resume_server` and `resume_cohort` are mutually exclusive. Neither mode rebuilds
or republishes the engine. An `E404` alone is not evidence that an earlier
accepted publish failed: do not select recovery merely to repeat that operation
during npm's processing delay. A publication error stops recovery without retrying
the mutation. Promotion remains a separate operation.

## Consumption after publication

```sh
npm install --global @lensmap/language-server
lensmap-lsp --configure-zed --zed /usr/bin/zeditor
```

Use a verified host executable path. Merge the printed settings into the intended
workspace and keep the separately installed Zed dev extension; the npm package
neither modifies settings nor registers an editor extension. The Node/package
paths must remain installed. Alternatively, the prepared [Zed release flow](zed-release.md)
uses Zed's own npm installation of a pinned runtime when no binary override is
present. Its cached-runtime launch is qualified, and a fresh public npm runtime
installation passed package/browser checks. Zed's own fresh registry-download
launcher path still needs host acceptance; Zed registry submission remains
separate and human-led.
See [Zed setup](zed-browser.md).
