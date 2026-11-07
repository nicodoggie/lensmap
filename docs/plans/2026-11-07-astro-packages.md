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

## Immediate follow-up: child connection endpoints

Nico's two screenshots on 2026-11-07 show solid connecting lines stopping short of child outlines in both the standalone viewer and the Astro/Starlight viewer. His later steering explicitly prioritizes this fix now, before packaging closeout. Keep the qualified packaging baseline immutable; its receipts predate this correction.

- Investigate the shared routing/clipping/rendering path, rather than assuming another Starlight prose offset or applying host-specific compensation.
- Earlier host-geometry acceptance covered source starts and deliberately retained target-end clearance. It does not establish that these child endpoints are correct. Revisit that assumption against the new report.
- Establish a focused native RED for the actual destination-end failure, then correct the shared implementation and verify the standalone and packaged Starlight consumers under lens/zoom changes. Preserve real arrow/blocking-bar semantics rather than indiscriminately removing all relation-specific decoration clearance.
- If shared viewer bytes change after the packaging milestone, rebuild and requalify the affected distributables before publication. Do not publish earlier tarballs while claiming they contain the follow-up fix. A registry-authentication block need not stall this independent follow-up once local packaging acceptance is complete.

Shared correction is committed/pushed as `220c668`: unmarked targets now use the node outline, while marker-bearing ends retain their clearance. Incoming/outgoing neighbourhood continuations use the same distinction. Genuine native target-gap REDs preceded the change in both standalone and Starlight viewers. All 39 standalone browser checks, 76 web unit tests, web typecheck/build, and native Starlight target-end checks at narrow/intermediate/desktop widths and enlarged zoom pass.

The fresh unpublished Starlight consumer build in `artifacts/line-endpoints/manifest.json` is now installed and verified live in BF. The parent compared all 14 installed files with the exact tarball, read back the actual served module, verified five retained source identities and inspected the corrected screenshot. Native BF checks cover all 11 unmarked targets at widths 390/800/1440 and zoom 85%/200%, with maximum outline error `0.030914306640625px`; 15 grouped browser checks and seven reading checks pass without page errors. See `docs/probes/astro-bf-integration/brief.md` for exact identity and evidence. This closes the line fix, not publication: the older immutable baseline and BF production build predate it.

## Verified commit/push checkpoint

The subsequent Lensmap checkpoint passes `pnpm check`, `pnpm test:packages`, frozen-lockfile validation and native release-workflow `actionlint`. The combined package check freshly packs all four local artifacts, including the fixed Starlight viewer and language-server web preview, then qualifies the installed public declarations, native Astro/Starlight builds, hydrated/no-JavaScript reading and installed-server browser bridge outside the workspace. Its retained output is `artifacts/checkpoints/astro-commit/verification.log`; it does not replace or relabel the earlier immutable baseline. The independent 63-path review passed, with only the later endpoint regression and verification notes requiring parent reconciliation. This checkpoint commits/pushes Lensmap source, not BF changes, npm publication, tag promotion or registry-only consumption.
