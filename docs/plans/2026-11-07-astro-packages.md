# Ship the qualified Astro integration as npm packages

## Authorized goal

Nico approved committing, pushing and packaging the Astro work on 2026-11-07. Promote the existing, reviewed integration behavior rather than redesigning it. Work in Lensmap; do not modify the primary BF checkout. BF's isolated consumer worktree remains local unless its publication is separately approved.

## Package and trust boundaries

- `@lensmap/astro-loader`: framework-neutral Astro content integration, metadata adaptation and build-time thought rendering. No dependency on Starlight, BF or React. Preserve authored `frontmatter`, effective schema-processed entry data, entry identity/file path and relative resolution as distinct concerns.
- `@lensmap/starlight`: thin Starlight composition using the actual existing Lensmap viewer/session and shared directional connection renderer. Bundle the existing viewer into its distributable; do not fork its algorithms or invent a third public package merely for this release.
- The document engine owns optional open top-level `frontmatter`; Astro owns site validation/defaults and executable-source policy. Preserve original source bytes and source locations.
- Default content is inert Markdown with consuming-site Markdown configuration. MDX requires explicit installed host capability and explicit source admission. Same origin, compiled output and hydration are not authorization. Admission is not sandboxing.
- Qualify against the actual installed Astro/Starlight versions; document and narrowly bound the private Astro content-rendering seam rather than claiming a stable public hook.
- No BF canon, metadata panels, provider-global configuration, credentials or absolute checkout paths in npm artifacts. Framework/package paths must be portable.

## Preserved product behavior

One actual viewer session; host-rendered selection and shared directional connections. Starlight tokens and public icons control host chrome. Graph colors/layout remain graph-owned. A native, initially closed mobile Thoughts disclosure is independent of host metadata/TOC. Selected prose uses normal document scrolling, short thoughts fully expanded, long thoughts with accessible Show more and selection reset. Only the interactive viewer opts out of host prose styling. The full lower article is always visible without JavaScript, with no generated outer heading/disclosure and no authored-heading cleanup.

## Execution milestones

1. Push the already-verified viewer/probe-documentation checkpoint; read back the exact remote branch tip.
2. Add focused RED/GREEN tests and native core support for optional `frontmatter`, preserving unknown top-level-key errors and source/snapshot fidelity.
3. Implement the two real npm packages with owned manifests, portable built outputs, explicit peer/dependency closure and focused tests. Parent owns the workspace lockfile and root release/build configuration.
4. Extend existing pack/smoke/release tooling without regressing immutable-artifact identity, registry-readiness recovery or existing runtime publication. Select and document a synchronized feature-release cohort after inspecting current tooling; do not overwrite an existing npm version.
5. Build actual tarballs and install outside the workspace. Exercise native Astro and Starlight builds, Markdown configuration inheritance, schema metadata, source-relative MDX imports, admission rejection and no-JS/full-article behavior. Use synthetic package fixtures, not BF canon.
6. Qualify exact packed artifacts in the existing isolated BF consumer, retaining its current acceptance suite and immutable source checks. No primary-site migration.
7. Run relevant source/packed/browser gates, independent review and artifact-content audit. Make verified local milestone commits and push the exact approved feature branch. No implicit main merge or site deployment.
8. Publish only the retained verified tarballs through the existing npm release path, with explicit experimental compatibility documentation. New package bootstrap/authentication may require Nico's interaction: current `npm whoami` returns E401. Do not bypass authentication or manufacture success. Read registry metadata/tags/integrities back and prove a fresh registry consumer before declaring publication complete.

## Completion evidence

Record source SHA, branch/remote SHA, exact tarball manifest/integrities, dependency versions, actual command results, native consumer results, registry IDs/tags and any remaining bootstrap/auth blocker. A successful workspace build alone is not package qualification, and a successful publish response alone is not release closeout.
