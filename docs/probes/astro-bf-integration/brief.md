# BF / Lensmap integration probe

## Latest authorized PoC continuation

Nico subsequently authorized continuing to a visible PoC and opening its dev environment in the shared preview. These specific additions supersede the earlier synthetic-only and no-preview restrictions below:

- The BF thread owns implementation/wiring in `/home/ensu/.t3/worktrees/bastion-falls-astro/lensmap-integration`; the Lensmap parent owns changes to Lensmap's viewer/reusable entry and performs final shared-preview checks. Do not duplicate writers or lens algorithms.
- Convert exactly `astro/src/content/docs/world/notes/the-vengeful/threads/elven-boons.mdx` into a `.lensmap` example in the BF worktree, preserving wording, links and page metadata. Use simple untyped nesting/connections; do not invent richer canon relationships. Preserve the original bytes as a comparison fixture outside active docs routing if needed to avoid a duplicate route. The primary BF document stays untouched.
- Use the actual Lensmap spatial-lens viewer for the visible PoC. A temporary selection harness may still prove an isolated seam but is not the user-facing deliverable.
- The BF thread should keep one owned local dev server available and return its actual URL, port and command. The Lensmap parent owns opening and exercising the shared preview; the user explicitly requested that browser work.
- Retain all other safety/publication boundaries. This does not authorize deployment, publication, account changes or a general BF migration.

## Role and authorization

Run one bounded, local feasibility probe in a **T3-allocated Bastion Falls worktree**, requested by Nico as a `lensmap-integration` experiment. This is not authorization to ship production packages, migrate BF's primary checkout, publish anything, or complete the entire Astro roadmap. Act as a leaf implementer: do the work yourself and start no further agents.

Read this brief first, before repository discovery. Then read the allocated checkout's `AGENTS.md` and any applicable `AGENTS.local.md` or nested instructions. Do not read provider-global memories, memory-search tools, other projects, `.env` or credential files. Do not inspect `5etools-src` or unrelated BF canon/transcripts.

## Workspace identity and ownership

- Target T3 project: `7307e527-6f74-4d79-9bfa-067c8bb78166`, canonical repository `/home/ensu/Projects/bastion-falls-astro`.
- The inspected BF primary checkout is on `feat/castle-dragonheart` at `75725a65c8b120302049c4e91cf1ba3e09cd6994`, with substantial unrelated dirty canon/skill/submodule work. Do not copy, edit, clean, stage or commit that work. No fetch or base substitution is authorized.
- Before any implementation write, verify the T3-allocated checkout's absolute cwd, repository top level, Git common directory, branch, HEAD and status. Its Git common directory must belong to BF, not Lensmap. Verify the base is the inspected BF commit above. If native allocation targets the wrong repository or base, stop and report; do not create a checkout in the shell, rename/switch the primary branch, or silently work in either primary checkout.
- Read-only Lensmap source: `/home/ensu/Projects/lensmap`, clean parent baseline `e41ad02184a4fa205b206232dfb0d03798e021de` before this brief was added. The parent may add probe documentation in Lensmap; you may not modify Lensmap code, manifests, Git state or artifacts.
- Own only the allocated BF worktree's probe source, synthetic fixtures, minimal integration wiring, necessary local manifests/lockfile, and evidence. Prefer `spikes/lensmap-integration/` for probe code/report, a clearly isolated synthetic docs namespace for fixtures, and narrow changes to `astro/astro.config.ts`, `astro/src/content.config.ts`, or the sidebar wrapper only when necessary. Do not edit existing canon or unrelated packages.
- No commits, pushes, remotes, PRs, deployment, external records, account changes, new credentials or publication. Keep the experiment uncommitted for parent review. Do not remove the worktree afterward.
- For temporary allocations set and verify `TMPDIR=/home/ensu/.hermes/cache/scratch/lensmap-bf-integration-probe`; never use the system temporary directory. Retain durable results and screenshots under the owned probe directory, keeping dependency/build/cache trees out of source staging. Do not symlink writable dependency/build trees to the primary checkout or copy its secrets. Normal package-manager store reuse is fine; acquire only needed dependencies after inspecting the scripts and lockfile.

## Settled design context

Lensmap is a TypeScript/pnpm/Turbo project with a working document engine and React spatial-lens viewer. Core keeps graph semantics host-independent. Plain Markdown is already rendered in the standalone viewer; a published Astro embedding API and frontmatter support are not yet implemented.

The agreed Astro direction is:

1. Optional top-level `frontmatter` is an open-ended object in core. An Astro collection validates/interprets its contents. One `.lensmap` document becomes one entry; graph content stays distinct from metadata. Preserve source and normal entry identity/path information.
2. `@lensmap/astro-loader` is the selected future workspace package in Lensmap. It may expose both a collection loader and associated Astro integration. The Astro-aware layer coordinates loading, metadata and compilation. A thin `@lensmap/starlight` layer adds docs-specific schema/context, routes and UI rather than a second parser or compilation system.
3. `frontmatter` authored in the map must reach the consumer's schema-processed `entry.data`, including defaults/transforms and BF's existing schema extensions. Raw authored metadata and effective collection data are distinct. Give the content renderer the entry/source context, not just a Markdown string. Do not serialize whole server/request contexts or arbitrary metadata into browser assets by default.
4. Thought Markdown should inherit the site's Markdown processing. MDX requires a genuine Astro build/compiler bridge; loader `renderMarkdown()` does not compile MDX. The official `@astrojs/mdx` factory returns an Astro integration, not a string-renderer callback. Inspect the installed versions and supported mechanisms; distinguish a private-hook experiment from a supported public API.
5. Execution policy belongs with the host integration options in `astro.config.ts`, not in portable map source. The exact future API names are proposals, not approved public schema. An explicit executable renderer plus an admitted source path are both necessary. Only admitted map sources may introduce executable content. Same origin is insufficient authority. Raw maps fetched arbitrarily at runtime render as non-executable Markdown; cross-origin maps always take that path. Do not compile fetched MDX at runtime, accept a map's own trust claims, or treat pre-rendered HTML/component assets as automatically trusted. Source allowlisting is not process/import sandboxing. Publication of raw source is a separate permission.
6. Starlight's left navigation and right `PageSidebar` are different. BF owns both overrides. Its right rail currently composes Fantasy Calendar, page-information cards and TOC; mobile has a separate Page Info presentation. Nico approved BF explicitly extending a reusable Lensmap sidebar shell, with BF supplying its own contextual panels. Preserve their route/metadata conditions, ordinary docs behavior and the left override. Keep document metadata distinct from live thought selection. A live inspector needs the same selection/navigation session as the map, not copied build-time selection data.
7. Full `.lensmap` docs participation must be distinguished from a custom route merely wrapped in `StarlightPage`. Native autogenerated navigation, production draft exclusion, source identity and useful static/searchable content are important boundaries. Empty headings do not inherently remove the right rail, but disabling route TOC can gate the entire column. Do not add fake headings as a workaround or import playground-global CSS.

## Actual probe, not a production implementation

Build the smallest runnable fixture against **BF's installed Astro/Starlight/MDX configuration and existing integration machinery** that answers this coupled integration question. Start with source tracing of:

- `astro/astro.config.ts`;
- `astro/src/content.config.ts` and its imported collection schemas;
- `astro/src/components/PageSidebar.astro`, `PageSidebarInfo.astro` and `MobilePageSidebarInfo.astro`;
- existing Satteri plugins/component import handling and relevant installed framework sources/types.

Use synthetic, explicitly noncanon probe content and harmless components only. Do not broadly scan lore or load external services. Inspect package commands before invoking them: site scripts include calendar preparation; do not launch deployment, transcription or other external workflows. Read installed Turbo documentation before changing any Turbo configuration/tasks; ideally leave them untouched.

Try to demonstrate these boundaries with native output, in risk order:

1. A synthetic `.lensmap` entry's frontmatter survives collection validation and reaches rendered thought content, including one real BF metadata extension or schema default. Preserve the actual source path. Use the real Lensmap document engine where feasible, not an independent invented graph parser. The current engine's strict root lacks frontmatter: a probe-only adapter may separate metadata before invoking it, but explicitly report that this is transitional adapter behavior, not implemented core frontmatter support.
2. A trusted thought renders a harmless MDX component/expression through BF's actual MDX processing with entry-aware data. An otherwise equivalent source outside the admitted paths does not execute, even on the same origin. Test a safe observable execution witness and render the denied source through the non-executable fallback; no shell/code-execution stunts or access to secrets. If a framework hook cannot support this, preserve a concrete failed attempt and return a bounded negative/partial verdict instead of faking compilation output.
3. Establish whether Markdown/MDX and `.lensmap` can participate in the real docs collection/routes together. Exercise generated navigation and production draft exclusion if the selected path supports them; if only custom pages work, name that limitation explicitly. Keep this a local build, not a public deployment.
4. Exercise the sidebar composition using BF's actual wrapper/panels and one live selection source. Prefer reuse of the current Lensmap viewer if practical without a large extraction/refactor. A minimal selection harness is acceptable for testing metadata/sidebar coordination when necessary, but label it accurately: it does not prove the full lens viewer, public embedding API, or cross-map history. Do not spend this spike recreating lens/layout algorithms. Check an ordinary docs page, a probe map page, and a narrow viewport so missing/duplicated rails and displaced BF panels are observable.

The report may be PARTIAL or INVALIDATED. Do not broaden into a general compiler/plugin framework, full package extraction, core schema implementation, complete sandbox, source-publication endpoint or BF-wide migration just to obtain a green verdict.

## Verification and return

Use artifact-proportional evidence: focused RED/GREEN for any maintained executable policy/loader behavior; native Astro compilation, collection data, generated HTML and rendered browser proof for the integration seam. Do not add a bespoke configuration-test framework or run unrelated full-monorepo suites. Record pre-existing blockers honestly.

Verify relevant UI with local Playwright, retaining and inspecting desktop/narrow screenshots and semantic assertions. The request is a code/integration probe, not authorization to open the shared T3 preview; do not use `preview_*` unasked. Use the project's existing tooling where possible. Stop only owned probe processes and record their final state.

Create `spikes/lensmap-integration/README.md` in the allocated worktree with:

- exact checkout path, branch, base and consumed package versions;
- reproducible setup/build/test/run commands;
- the actual source path through loader, schema, compiler and renderer;
- supported public hooks versus private/experimental seams;
- VALIDATED / PARTIAL / INVALIDATED verdicts for the boundaries above;
- concrete outputs, screenshots and any observed failures;
- minimal recommended next changes in Lensmap versus BF, without claiming the production integration exists.

Return that report's absolute path, changed-path inventory, actual commands/exits, browser evidence paths, remaining owned process information, and any blockers. Also return the final `git diff --check` result and worktree identity. Do not create a PR or publish anything. Parent will inspect the artifacts and reconcile claims before reporting success.
