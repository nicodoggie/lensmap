# Custom connection types implementation plan

## Goal and authority

Implement [the accepted specification](../custom-connection-types.md), including
its technical defaults, across the engine, actual viewer, project-aware language
server and Astro/Starlight consumers. Nico requested implementation on
2026-11-10. Preserve existing source/navigation/host security and untyped behavior.
Local verified milestone commits are authorized; pushes and publication are not.

Base: `13ec817` on `feat/custom-connection-types`. The tree was clean before
native pnpm added `css-tree` 3.2.1 and its types to the document package. Use that
maintained CSS parser/lexer rather than implementing a CSS parser or using DOM
validation inside the engine. Existing YAML/Zod remain the owning parsers.

## Architecture and shared interfaces

The document engine owns declaration validation, raw layer merging, inheritance,
resolved wording/presentation and destination capability. Consumers never infer
capability from a custom name. Node-only project loading is an explicit
`@lensmap/document/project` export, never imported by the browser root entry.

Pin these interfaces so disjoint engine/viewer/host work composes:

```ts
export interface ConnectionPresentation {
  strokeWidth: number | string;
  lineStyle: "solid" | "dashed" | "dotted";
  lineColor: string;
  startMarker: "none" | "arrow" | "bar" | "circle" | "diamond";
  endMarker: "none" | "arrow" | "bar" | "circle" | "diamond";
  text: string;
  reverseText: string;
}
export interface ResolvedConnectionType extends ConnectionPresentation {
  coreKind: "ordinary" | "map_link" | "external_link";
}
export interface VocabularyInput {
  declarations?: ConnectionTypeDeclarations;
  source?: string;
  uri?: string;
  error?: string;
  offset?: number;
}
```

- Export declaration types/schemas from the document root and `/v1` as
  appropriate. Keep the existing built-in enum export for compatibility;
  authored names and semantic `ConnectionType` become exact strings.
- Add optional `presentation: ConnectionPresentation` to semantic edges and
  carry it intact into laid-out edges. No registry/global viewer state is needed
  to paint an already analyzed graph. Untyped edges use the unchanged neutral
  fallback; built-in base width is the existing 2.5 scene units.
- Extend `connectionWording(type, direction, presentation?)` compatibly with an
  optional third argument. Consumers pass each edge's presentation.
- `DocumentSession(uri, source?, revision?, vocabulary?: VocabularyInput)`;
  `setVocabulary(input: VocabularyInput): DocumentSnapshot` reanalyzes unchanged
  source. Content-edit validation uses the same vocabulary input.
- Snapshots expose optional `vocabulary: Record<string, ResolvedConnectionType>`
  and `graphGeneration: number` (optional for old typed fixture compatibility).
  A successful new analysis advances graph generation even at the same source
  revision. Invalid analysis retains the complete old graph/presentation and
  generation. LSP/bridge caching must not use source revision alone.
- `parseVocabulary(source, uri?): VocabularyInput` returns either declarations
  or a located error. Export enough declaration provenance for type/parent hover
  without embedding filesystem context in graph presentations.
- Node `/project` exports `readProjectVocabulary(root, buffers?)`, where buffers
  is a readonly map from absolute file paths to live text, returning
  `{ input: VocabularyInput, files: string[] }`. Files are exact absolute config/
  vocabulary watch targets, including missing targets. Root/config-relative
  resolution, strict JSON (including duplicates), `.lenstypes` YAML, realpath
  authorization, and no silent configured-file fallback belong here. Do not read
  unrelated source, credentials or parent/sibling project configuration.

Implementation may refine a contract only with explicit parent reconciliation,
not by independently changing both its spelling and semantics in one leaf.

## Task 1: Engine and bounded project vocabulary loading

**Owned paths:** `packages/document/**`; parent owns `pnpm-lock.yaml` and
`schemas/**`. New files may include `src/vocabulary.ts`, `src/project.ts`,
focused tests and declarations. No other source ownership.

1. Add focused failing tests for declaration structure, paired wording, CSS
   values, layer/parent precedence, exact/prototype-like names, unknown parents/
   cycles/core capability restrictions, inherited portals and stale recovery.
2. Witness RED with `pnpm --filter @lensmap/document test -- ...` against the
   actual checkout. Implement owning schemas/resolver/session changes. Do not
   replace the source/binding identity reconciliation or create a second graph.
3. Test vocabulary-only updates at the same source revision, valid content-edit
   preparation with custom types and unchanged shorthand/source identities.
4. Add Node-only project-loader tests in owned scratch fixtures: absent config,
   strict JSON/duplicate keys, config-relative target, missing/invalid file,
   live-buffer priority and realpath boundary. Implement the explicit export.
5. GREEN with document tests, typecheck and build. Use native schema export and
   parent integration rather than repeated broad workspace suites.

## Task 2: Actual connector rendering and wording

**Owned paths:** `apps/web/src/**`, `apps/web/e2e/**`. No engine, host, package
manifest or lockfile ownership.

1. Add a focused RED proving metadata-only layout projection retains edge
   presentation and node positions. Carry presentation through `graph.ts`,
   `semantic-layout.ts`, bridge caches and every connection wording consumer.
2. Extend/refactor the existing connector/marker renderer, including
   `Viewer.tsx`, `NeighbourhoodContinuations.tsx` and `ConnectionGap.tsx`, rather
   than forking a second rendering path. Preserve built-in geometry/interaction.
3. Qualify widths with native browser CSS resolution in a root-font, pre-scene-
   zoom context. A hidden CSS layout probe may resolve length/math against an
   explicitly sized normalized-diagonal percentage container; never implement a
   second CSS expression evaluator. Use resolved pixels for marker clearance.
4. Add circle/diamond outlines and both-end clipping, transparent marker interiors
   and bar gaps, width-relative dashes/dots/halos, zero-width nonpainted routes,
   explicit colours and continuation endpoint orientation. Keep hit paths usable.
5. Add actual Playwright regression coverage for these independent failures,
   including inspection/panning and same-source-revision bridge updates. Capture
   narrow/desktop images; use local Playwright, not unasked shared T3 preview.
6. GREEN focused web tests/typecheck/build and new browser checks. Parent runs
   the complete browser suite once after integration.

## Task 3: Project-aware hosts and native consumers

**Ownership:** parent owns `packages/language-server/**`, `editors/zed/**`,
schemas, examples, documentation and the lockfile. The Astro integration leaf
owns `packages/astro-loader/**` and `packages/starlight/src/**` plus
`packages/starlight/test/**`. Neither leaf may edit `apps/web/**` or the engine.

Host proof already witnessed: the LSP project-vocabulary regression was RED
(configured custom name rejected) and now all six server tests plus typecheck
pass, including live-buffer priority, stale recovery, native file reload and
same-source-revision updates. The Astro adapter's configured-vocabulary
regression is RED in `artifacts/checkpoints/custom-types/astro-red.log`; its
test passes the Node loader's input to `parseMap` as the optional third argument.

1. LSP RED: initialize with explicit workspace roots; config/shared vocabulary
   loads independently of cwd; an unchanged-source vocabulary edit updates the
   preview and invalid vocabulary retains stale graph/presentation.
2. Use the Node loader and exact-file watchers; distinguish vocabulary/config
   buffers from map documents. Prefer available live buffers, clear their own
   diagnostics on close and do not attach arbitrary JSON/YAML as thought maps.
   Teardown all owned watchers. Preserve HTTP attachment/origin/auth guards.
3. Completion/hover use the same resolved vocabulary for `type` and `extends`.
   Preserve ID/reference tooling and source revision checks. Register `.lenstypes`
   as YAML in Zed without claiming all JSON/YAML files.
4. Astro RED: project-root configuration affects native map analysis and emitted
   presentation; invalid configured vocabularies fail builds. Wire shared input
   to both entry info/render, preserve metadata and MDX source admission, track
   config/vocabulary dependency changes for development reload.
5. Extend existing synthetic native Astro/Starlight fixtures with actual shared
   and inline types so installed-tarball acceptance covers the new closure. Do
   not use BF source or modify its checkout. No new placeholder packages.

## Task 4: Integration, qualification and milestone commits

1. Review each returned leaf against its exact ownership and the spec; fix small
   integration findings directly. Use one fresh independent combined spec/code
   review for the integrated candidate, not per-leaf review ceremony.
2. Export structural JSON Schema from the owning Zod definitions; format with
   the installed native formatter. Update schema/user docs and a runnable local
   vocabulary example. Mark the specification's actual implementation/evidence
   status honestly.
3. Run `pnpm check`, `pnpm test:e2e` and `pnpm test:packages` on the integrated
   candidate. Existing packed checks must exercise document exports, installed
   LSP bridge and native Astro/Starlight consumers. Inspect actual screenshots.
4. Keep evidence under ignored `artifacts/checkpoints/custom-types/`; make local
   commits at coherent verified milestones, staging only owned source/tests/docs
   and dependency manifests/lockfile. Do not bump/publish versions or push refs.
5. Report actual acceptance results and any native host limitation; do not call
   a parser-only implementation or a passing mock whole-feature completion.

## Parent integration checkpoint

- Engine leaf delivered; parent corrected default portal markers, valid CSS
  colour rejection, unknown-reference error locations and declaration provenance.
  Parent owning engine suite: **90 tests passed**; typecheck/build passed.
- Project loading now emits proper file URIs, diagnoses configured-file failures
  at the config path and excludes denied vocabulary targets from watch lists.
  Synthetic project tests use the runtime temporary directory rather than a
  developer-specific home path, and remove their own fixtures.
- LSP parent integration: **6 tests passed**, plus typecheck. The configured
  vocabulary scenario now checks cross-layer parents, hover/definition navigation,
  vocabulary/config diagnostic URIs, native reloads, unchanged map revisions and
  coherent stale recovery. External errors are not mapped onto unrelated map lines.
- Both generated schemas were exported and formatted; representative vocabulary
  Ajv checks passed. The new shared example ran through the real Node project
  loader and document engine; its effective widths, colour, wording and markers
  matched the declarations. Documentation lint passed for the five updated guides.
- Renderer and Astro/Starlight leaves are integrated. The full workspace check
  and all **41 browser tests passed**. The actual installed-tarball gate passed
  native Astro/Starlight static and dev behavior, public types and **4 installed
  bridge browser checks**. The parent inspected desktop/narrow viewer images.
- The combined independent review found one P2: raw completion labels could
  become YAML booleans/comments or invalid scalars. A focused RED reproduced it;
  the corrected scalar text edits now pass **7 server tests**. Empty-value comment
  separators and quoted replacements are included.
- Installed dev qualification also exposed CommonJS dependency prebundling and
  an undeclared consumer-workspace boundary. Native Vite optimization and a real
  npm workspace declaration corrected these without relaxing filesystem guards.
- The bounded fix review passed SPEC and QUALITY/SECURITY. Final workspace and
  installed-consumer gates passed on the repaired implementation. The verified
  local milestone is ready for commit; pushes and release remain unauthorized.
  No push or release has been made. See the
  [qualification record](../verification/custom-connection-types.md).

## TDD and custody boundary

Use focused RED/GREEN for new executable resolution, reload/state-machine and
rendering behavior. Use native package management, schema generation, types and
format/lint for declarative artifacts; no config string-assertion test suite or
bespoke verification framework. Preserve this spec's user-facing failure rules,
not arbitrary fixture counts/hashes. No secrets, global/provider memories,
account changes, unrelated projects or subdelegation by leaf workers.
