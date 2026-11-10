# GitHub Pages site implementation plan

**Goal:** Deliver the approved real-Lensmap homepage and conventional example-led
Starlight documentation as one static site.

**Architecture:** A private `apps/site` Astro application owns the homepage and
host navigation; Starlight owns docs. Hero and examples use the existing document
engine and shared viewer. The public deployment is a separate approval gate.

**Tech stack:** Existing pnpm/Turbo, Astro 7.4.0, Starlight 0.42.6,
`@astrojs/react` 6.0.6, React/React DOM 19.3.1 and existing Lensmap workspaces.
Use the maintained Astro checker if needed, resolving its compatible version
through pnpm rather than guessing it.

## Governing context and execution

Read [the approved site design](../github-pages-site.md), `HANDOFF.md` and
`AGENTS.md` first. Inspected baseline is `main` at
`260bf573093ca5eaccbd47f6cdf193a7fd9cfb2f`; verify the live root, branch, HEAD and
status before implementation. Work exclusively in Lensmap.

Follow the personalized TDD/review boundary: focused RED/GREEN for new framing
or navigation behavior; native tooling for manifests, static config and Pages
workflow. Do not create substring/configuration suites, placeholder packages,
per-function tests or a fresh implementation worker/reviewer for every leaf.
A parent-owned implementation and one bounded independent combined review are
sufficient unless a concrete new risk requires separate attention.

Do not push, enable Pages, deploy or publish npm packages as part of local work.
Local verified milestone commits follow repository policy. Preserve the earlier
release artifacts and all sibling projects.

## Task 1: Establish the real site application

**Create:**

- `apps/site/package.json`
- `apps/site/astro.config.mjs`
- `apps/site/tsconfig.json`
- `apps/site/src/content.config.ts`
- `apps/site/src/pages/index.astro`
- `apps/site/src/styles/site.css`

**Modify as needed:** `pnpm-lock.yaml`, `turbo.json`, root `.gitignore` and
`package.json`. Change only necessary task wiring, scripts and generated-output
ignore rules. `pnpm-workspace.yaml` already includes `apps/*`.

1. Create a private `@lensmap/site` package with native dev/build/preview and
   typecheck commands. Declare every directly used framework and workspace
   dependency. Keep published package manifests and versions unchanged.
2. Configure Astro static output, project site/base and React/Starlight. Reuse
   the mixed collection pattern already qualified in
   `packages/starlight/test/site/src/content.config.ts` where map routes are used.
   Keep `/` as the custom homepage and docs beneath `/docs/` in site-relative
   routing, with production base `/lensmap/`.
3. Install with native pnpm, review manifest/lock deltas and prove a subsequent
   frozen install. Approve no new lifecycle scripts indiscriminately.
4. Read the installed Turbo README and relevant task docs before any task edit.
   Account for the hero's source import from `apps/web/src/embed.ts`: declare
   `@lensmap/web` and the real build dependencies rather than relying on an
   invisible cross-workspace import. Use native Turbo dry-run output to verify
   ordering; do not add a custom graph validator.
5. Build the real homepage plus a first conventional docs route. No fake package
   exports or empty future packages. Add only the Astro-generated directories
   that actually need ignoring.

**Evidence:** native frozen install, native site typecheck and static build.
This is configuration/application composition, not a bespoke manifest TDD task.

## Task 2: Build the actual Lensmap hero

**Create:**

- `apps/site/src/maps/hero.lensmap`
- `apps/site/src/components/HeroMap.tsx`
- `apps/site/src/hero.ts`
- `apps/site/src/hero.test.ts` if pure framing/navigation logic warrants it.

**Modify:** homepage and site CSS from Task 1.

1. Author the wordmark, subtitle and navigation as a small real graph, using
   existing rich nodes, explicit connections, positions and node styles. Keep
   site routes together with their real destination entries, not a second
   independently maintained navigation dataset.
2. Read raw source at build time and analyze it with `DocumentSession`. Fail the
   native build on invalid analysis, and project with `layoutSemanticGraph`.
   Do not import private adapter helpers or invent a new parser.
3. Wrap the real `Viewer` from `apps/web/src/embed.ts`, with `embedded` and
   `showInspector={false}`. Use its existing props, not undocumented public
   `ViewerHost` callbacks. Keep node appearance in the authored map and chrome
   overrides scoped to the homepage wrapper.
4. Measure the actual host container for initial framing before mounting the
   interactive viewer. Use the renderer's geometry rather than assuming that
   numeric base size equals its final lens-projected screen radius. Preserve
   exploration state on later resize; do not recenter on ordinary pan/zoom.
5. Implement site-owned `onActivatePortal`: base-aware local destinations use
   same-tab navigation; GitHub opens separately with explicit opener isolation.
   Preserve the renderer's select-versus-activate distinction. Supply an obvious
   selected-destination anchor/action so pointer users need not infer a hidden
   double-click gesture.
6. Render ordinary semantic title, subtitle and native navigation in the Astro
   document. Keep Documentation visible outside the interactive map. Avoid
   duplicate focusable fallback content, focus stealing and automatic motion.

**RED/GREEN:** use a focused browser regression against the built site for the
meaningful user seam: actual shared nodes, initial giant bubble and visible
satellites, real panning, and base-aware destination activation. Add pure tests
only for a nontrivial site framing/navigation helper, not framework rendering.

## Task 3: Write conventional docs and live examples

**Create under `apps/site/src/content/docs/docs/`:**

- `index.md`
- `getting-started.md`
- `authoring.md`
- `navigation.md`
- `connection-types.md`
- `node-styling.md`
- `integrations.md`
- `examples.mdx`

**Create:** `apps/site/src/components/MapExample.astro` and small, self-contained
example files under `apps/site/src/maps/` as required by the actual examples.

1. Write task-oriented docs against the published 0.3.0 behavior and current
   canonical references. Preserve experimental-v1 wording, optional authored IDs,
   explicit topology and source/host permissions.
2. Use conventional Starlight navigation/search, headings and code blocks.
   Prefer a quick usable map before an exhaustive schema inventory.
3. Show example source and the live result from the same source file. Use the
   supported framework integration or the existing source viewer at this
   concrete consumer; do not duplicate parser/rendering logic or claim fetched
   Markdown is executable MDX.
4. Check YAML examples with the owning engine, including both node-style forms
   and a custom relation. Avoid network-dependent examples and private content.
5. Keep deep technical specifications linked, not copied wholesale. Do not
   expose development evidence, host paths or internal plan prose on the site.

**Evidence:** native content/build diagnostics plus the built docs/example
browser checks. The same-source example composition removes a drift seam; no
second schema or documentation validator is needed.

## Task 4: Qualify the GitHub Pages build locally

**Create:**

- `apps/site/playwright.config.ts`
- `apps/site/e2e/site.spec.ts`
- `.github/workflows/pages.yml`

1. Test the actual production build at `/lensmap/`, not only a root dev server.
   Use a strict owned local preview port and existing Playwright/Chromium tools.
2. Exercise desktop and narrow first-load framing; selection/activation and
   pointer/keyboard exploration; ordinary Documentation links; a direct docs
   visit/reload; source/live example agreement; and Starlight search.
3. Use a no-JavaScript context to verify real title, subtitle and navigation.
   Inspect desktop/narrow screenshots, waiting for measured geometry before
   capture. Do not use shared preview tools unless the current request asks to
   show or operate the browser with the user.
4. Resolve Pages action revisions from official current guidance, pin them and
   prepare native artifact/deployment jobs with explicit permissions, concurrency
   and the correct output directory. Do not invent a custom deploy script.
5. Validate YAML/workflow with native tools such as `actionlint`, and inspect
   Astro's native output. No substring tests for the workflow. Do not enable the
   workflow remotely or change repository Pages settings during local work.

**Commands after scripts exist:**

- `pnpm --filter @lensmap/site typecheck`
- `pnpm exec turbo run build --filter=@lensmap/site`
- `pnpm --filter @lensmap/site test:e2e`
- `pnpm lint`
- `actionlint .github/workflows/pages.yml`
- `git diff --check`

Run `pnpm check` once at the stable combined milestone so the new workspace is
included. Reuse unchanged feature/release evidence rather than reinstalling or
republishing the npm cohort. If shared viewer code changed, run its focused
regression and the existing standalone browser suite for that actual boundary.

## Task 5: Review and checkpoint

1. Freeze the exact changed source/tests/config/docs, including new files.
2. Obtain one bounded independent spec/quality review against the design.
   Require concrete findings, guard economy and exact candidate identity.
3. Resolve actionable findings with the smallest native/focused evidence and
   recheck only the affected invariant when necessary.
4. Record actual commands, counts, screenshots and limits under ignored
   `artifacts/checkpoints/github-pages-site/`. Update repository run instructions
   with the exact working site dev and production-preview commands.
5. Stage only owned source, tests, manifest/lock, workflow and docs. Make a
   meaningful local checkpoint after review and gates pass.
6. Report the working local site and candidate. Obtain explicit approval for
   push/Pages settings/deployment before public mutation, then verify the actual
   live base URL and representative docs/assets if deployment is authorized.

## Stop conditions and explicit exclusions

Local completion requires the functional hero, normal docs and examples, native
build/type/lint/workflow checks, real rendered desktop/narrow/no-JavaScript
acceptance, resolved review and a local checkpoint. A written workflow is not a
live deployment, and a successful build is not a Pages availability claim.

No sibling changes, npm release, editor-extension bump, account/credential
changes, new schema grammar, generic animation system, separate renderer,
analytics or custom domain.
