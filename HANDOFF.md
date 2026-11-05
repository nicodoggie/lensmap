# Lensmap handoff

## Latest user request and execution ownership

Create Lensmap as a separate project at `/home/ensu/Projects/lensmap`, and continue in a new T3 thread bound to that folder. User explicitly selected **TypeScript**, **pnpm**, and a **Turborepo monorepo**. Development order: **web app first, then the embeddable viewer, then the language server**, all in this monorepo. This is authorization to set up the project and start the web-app phase, not just write another proposal. Do not restart settled product discovery. Do not pretend the full future product is implemented by scaffolding.

The parent registered T3 project `mcp:81ef1216-2d43-4bbc-b749-5a0b86ab0020`, title `lensmap`, workspace root `/home/ensu/Projects/lensmap`. At handoff the folder contains only this document; no dependencies installed, no scaffold, no Git initialization or commits made here. Discovery reported Node `v24.22.1` and pnpm `12.15.0`; verify live before relying on them. `git -C /home/ensu/Projects/lensmap rev-parse --show-toplevel` previously resolved to `/home/ensu/Projects`, an enclosing repository: do not accidentally operate on that repository. Initialize a separate nested repository for Lensmap if appropriate; no commits, pushes, remote creation, or publication without user permission.

Own writes exclusively within Lensmap. Do not modify `/home/ensu/Projects/bastion-falls-astro`, its dirty files, or unrelated projects. No credential/account/global configuration changes. Read project-local instructions if any have appeared since handoff. Use ordinary shell dependency acquisition and local tests within this project; no unnecessary global installs. New application/package code should be TypeScript.

## Product purpose

Text-first exploratory mind mapping that supports **cycles and converging connections**, without manually creating each diagram shape and connector. Write thoughts first; renderer creates nodes, edges and initial layout automatically; visual positioning is optional refinement afterward. Markmap's outline-writing immediacy and Markdown tooling are substantive benefits, not merely a preference for text files. A separate world-article navigation graph inspired by Cosma was discussed but is **not this project scope**.

Do not swing recommendations merely to mirror the latest argument: Markdown-versus-YAML trade-offs were real. The latest substantial schema exploration is YAML containing Markdown and recursive graph shorthand. A complete grammar and editor architecture remain unapproved. User wants progressive elaboration, not a schema that demands verbose records for every thought.

## Working authoring semantics

- Top-level `nodes` accepts Markdown strings and richer node objects. Multiple top-level nodes are authored starting ideas; one naturally supports a traditional central idea. No mandatory separate central-node structure or automatic document-title node.
- A string is shorthand for a node with `full_text`. The whole string is Markdown, including its first-line title; subsequent lines provide below-fold exposition. Long-title truncation is presentation only and preserves the complete source text.
- Rich nodes can carry optional `id`, `summary`, `full_text`, `position`, and recursive `connections`. A supplied `summary` overrides collapsed display; without it, derive the displayed title from `full_text` using the same rule as string entries. `summary` alone works too. Do not require both fields or duplicated prose.
- Authored stable IDs are optional. Ordinary nesting needs none; add an ID only for addressable targets or identity-dependent features. Renderer-internal identities need not be persisted author-facing IDs. Inline positioning alone does not inherently require an ID.
- `connections` can include direct Markdown strings, rich child nodes, and references to existing nodes via `node_id`. Earlier sketches used `type: items` with an `items` array, and `type: link`; later discussion preferred using `connections` recursively instead of the `items` name and allowing direct references. Do not freeze obsolete wrapper/type syntax. Distinguish content-bearing nodes from reference objects and reject ambiguous forms deliberately rather than guessing.
- A rich child that has `connections` still supplies `summary` or `full_text`; a connections-only object is not an invisible grouping wrapper.
- Bare nested arrays have a deliberate meaning: **an unresolved intermediate thought**, parent -> unknown middle node -> array entries. Do not flatten away that middle node or mistake it for line-routing geometry. An explicit object equivalent supplies `summary` or `full_text` as `null` or an empty string (explicitly present, not absent/undefined), preserving its subtree. Check property presence, not truthiness. Exact validation and visual treatment still need care.
- Same-document Markdown fragment links navigate to/highlight their target node (or owning node for an internal section). **Prose links do not automatically create drawn edges.** Explicit `connections` govern graph topology. Heading slug identity, URL history and exact expansion behavior remain open.
- Optional document/page frontmatter and relative positioning were sketched, not finalized. Do not import Astro-specific page metadata wholesale into a standalone package by accident.
- Embedded Markdown rendering is not the same as editor integration: Markdown highlighting/linting/completion inside YAML strings requires explicit integration. An ordinary YAML schema does not automatically autocomplete live node IDs.

## Initial viewer direction: spatial lens

User explicitly chose to start with a **lens view**, analogous to navigating the watchOS app grid. Panning moves the graph through a spatial focus: central nodes enlarge, peripheral nodes shrink, with continuous, predictable movement. Do not silently substitute graph-distance sizing for spatial magnification; that was an earlier alternative.

Underlying authored layout and displayed lens deformation are distinct. User wants to try the lens first even though it may distort custom positioning. Neighbours and recognizable arrangement should remain trackable; avoid repacking into unrelated positions on every navigation. Natural movement may make the trade-off comfortable, but that is not yet qualified.

Use contrasting, legible connection colours. A prior experiment used stable branch colours, line-background halos, and dashed curved arrowed cross-links; these are prototype choices, not locked semantics. Do not rely on colour alone. An optional undistorted overview is desired; the eventual full view should expose the graph and expanded content, not falsely claim a fit-to-screen collection of tiny circles is that entire feature.

## Prior prototype and evidence limitations

Parent built a standalone HTML/SVG motion experiment with invented expedition notes (NOT Bastion Falls canon), hardcoded positions, panning, wheel zoom, click/keyboard selection, a note panel, lens strength, reset and an undistorted node overview. It did **not** implement YAML parsing, real Markdown rendering, editing, persistence, automatic layout, or a full-content overview.

It was saved at `/home/ensu/.hermes/cache/scratch/mindmap-lens/index.html` with a README, but **that scratch directory is now pruned**. Do not claim that file was moved or recovered. The original rendered source and tool calls exist in source T3 thread `897a30a6-84c8-4c2d-9ae7-447c47e84f08`, in Bastion Falls project `7307e527-6f74-4d79-9bfa-067c8bb78166`.

Source thread link:
<t3-thread://v2/83112fd3-0947-4d13-a1db-a76bf59117a7/897a30a6-84c8-4c2d-9ae7-447c47e84f08>

Historical HTML render attachment: `897a30a6-84c8-4c2d-9ae7-447c47e84f08-27219c8f-f22a-4dd3-89bf-385b0ce54f40-html`. Recover exact source through a bounded read of that thread's tool activity if useful. Hermes session_search for `mindmap-lens` returned no sessions, so do not repeat broad private-history searches. If original bytes cannot be recovered, say so; a fresh TypeScript implementation based on this brief is not byte-identical restoration.

Historical (not fresh) evidence: T3 html_preview rendered the experiment; browser-executed checks exercised graph rendering, lens scale, overview mode and bounds, keyboard selection and focus, prose-reference navigation without new edges, wheel zoom, reset, slider and a narrowed SVG overview. Checks completed successfully; inline JS passed node --check. Real physical drag/touch comfort, large-graph behavior, arbitrary overlaps and user judgement remained unqualified. Re-run appropriate evidence for new code; do not promote this to whole-product acceptance.

## First work in the new thread

1. Establish the exact project/Git boundary and preserve any newly arrived files. Add concise project instructions and durable design notes from this handoff.
2. Set up a pnpm TypeScript Turborepo workspace. Choose a lightweight web framework consistent with the lens experiment (React + Vite is a reasonable default, not a user-mandated stack). Keep web app / future viewer / future language server ownership separable; do not add empty implementation packages or speculative abstractions merely to fill a diagram.
3. Before changing Turbo configuration or task commands, install/resolve the selected Turbo package and read its bundled `docs/README.md` and applicable task/workspace docs. Do not guess commands based on older Turbo releases.
4. Deliver a runnable web-app starting point for lens exploration, with proportionate focused tests, typecheck/lint/build evidence and a reproducible development command. Avoid claiming completion of the entire parser/viewer/LSP roadmap. A visual editor and language server are later phases, not prerequisite implementation now.
5. Keep tests tied to owned behavior. Use native manifest/build/schema proof for configuration, focused tests for maintained logic, and real rendered checks for UI. No large throwaway verification framework.

Use T3 html_preview then html_render for a requested inline visual; no server solely to show an HTML visual. Use shared preview_* only when the current request asks for browser work or names a page/tab. No further delegation needed just to scaffold. Do not commit or publish without user instruction.
