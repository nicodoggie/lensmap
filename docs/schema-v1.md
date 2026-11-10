# Lensmap schema v1 — incomplete and experimental

`version: v1` selects the current working schema. **v1 is incomplete, not a frozen compatibility promise.** We can add or refine fields within this experimental version while its authoring semantics are being tried. It is independent of the application's package version.

The owning Zod definition is `packages/document/src/v1/schema.ts`; the old web path re-exports it for compatibility. `DocumentSchema` validates structure; `DocumentSession` checks document-wide IDs/references and constructs semantic graphs and source bindings. Layout belongs to the viewer. `pnpm schema:export` generates `schemas/lensmap.experimental-v1.schema.json` from that Zod input definition; representative Ajv parity tests cover content-field presence, nonblank IDs, strict objects and recursive entries. Duplicate IDs and unknown references remain semantic checks, not JSON Schema rules. This local export does not freeze a public schema URL or compatibility contract.

## Current shape

```yaml
version: v1
nodes:
  - id: first
    full_text: |
      # A starting thought

      This is all **Markdown**. A [prose reference](#shared) navigates without drawing an edge.
    connections:
      - A simple Markdown child
      - - A possible consequence
        - Another consequence
      - summary: null
        connections:
          - An unnamed thought can still have implications
      - node_id: shared
  - id: shared
    summary: "**A shared idea**"
    connections:
      - node_id: first
```

- The root has `version` (exactly the string `v1`), `nodes`, and optional `frontmatter`, `connection_types` and `node_styles`. Missing/other versions are errors; no legacy version is inferred. `nodes: []` is a valid empty playground.
- `frontmatter` is an open metadata object: `{}` is valid; null, arrays and scalar values are not. Its keys and nested values are opaque to the document engine. A host such as Astro owns metadata validation, defaults and transforms; authored metadata remains distinct from the host's effective entry data. Metadata does not create thoughts or connections, authorize executable content or enter the viewer graph/snapshot. Native source locations and minimal content edits still refer to the original YAML, without stripping or reserializing metadata.
- Each top-level entry is a Markdown string or rich node. There is no mandatory central node or automatic document-title node.
- A rich node supports `id`, `summary`, `full_text`, `position`, `classes`, `style`, and `connections`. Ordinary thoughts supply at least one defined content field (`summary` or `full_text`). Portal thoughts additionally accept a matching link `type` and nonblank `url`, without requiring prose. Summary-only and full-text-only nodes work without duplicated prose. Node presentation is described in [node styling](node-styling.md); `style` accepts a CSS declaration string or YAML property mapping, and `classes` selects document-local `node_styles`. Reference occurrences do not restyle their target.
- A string is shorthand for `full_text`. Its first line supplies the collapsed Markdown title; later lines remain in the complete note. A supplied summary overrides collapsed presentation. No source text is truncated or rewritten.
- `summary` / `full_text` accept strings or explicit null. Null/empty title content is an unresolved thought, not a missing grouping wrapper. An object with only `connections` is invalid. Explicit JavaScript `undefined` is not content; a blank YAML value is null.
- `connections` recursively accepts Markdown strings, rich nodes, `node_id` references with an optional `type`, and nested arrays. Rich entries also accept `type` beside their existing content. A bare array introduces a real unresolved middle node connected to its entries; it is not flattened into direct parent edges. Omitted types remain untyped, without inheritance or a configurable default.
- IDs are optional, nonempty strings, unique when supplied. They are preserved exactly, not trimmed or slugified. Renderer keys are internal and do not become authored IDs. A `node_id` reference must resolve in the same document; forward references, convergence, self-links and cycles are allowed.
- `position: {x: 100, y: -40}` supplies absolute, finite numeric coordinates. No ID is needed for positioning. Missing positions get an automatic initial radial branch layout on Apply; explicit coordinates remain exact. Nested children circle each root in source order, then fan outward around their own parents, with subtree contours reserving angular room. References do not reparent or attract nodes. Relative authored coordinates are not implemented; automatic parent-relative placement is not a new schema field or a frozen layout algorithm guarantee.
- Prose fragment links resolve exact authored IDs and collision-safe generated thought anchors. Generated anchors are stable through view changes, not promised across source versions or reopenings. Heading/section slugs remain undesigned. Prose links never add graph edges.

## Default connections and portals

The supplied types are `connected`, `precedes`, `follows`, `prevents`, `optional`, `external_link` and `map_link`. Additional names require a declaration in the effective vocabulary; undeclared names are semantic validation errors. `connected` is an explicit neutral alias; omission remains valid and genuinely untyped. Add `type` directly beside `node_id` or inline `summary`/`full_text`, not inside a new wrapper.

```yaml
version: v1
nodes:
  - summary: The patron is killed
    connections:
      - type: prevents
        summary: Access to house resources
      - type: optional
        full_text: Prepare a successor
      - type: map_link
        url: next-session.lensmap#council
      - type: external_link
        url: https://example.org
```

Link thoughts retain IDs, notes, positions and local connections. Type plus URL supplies an address fallback label when prose is omitted. References reuse a portal without redefining its URL or inheriting the new edge's type. An explicitly typed link reference must match the existing portal kind. Root link thoughts are allowed; other root relationship types are rejected because no incoming edge exists. Reject mixed references/content/URL overrides and URLs on ordinary relationship entries.

Neutral edges are solid and unmarked regardless of nesting/reference syntax. Sequence arrows point toward the later item; `prevents` has two parallel blocking bars at the target, with an empty gap rather than a connecting stroke between them; `optional` is dashed. Portals use unarrowed connectors and destination icons. These conventions do not execute domain logic. See [the complete connection contract](default-connections.md) for activation, source-relative loading, anchors and history.

## Custom declarations and shared vocabulary

`connection_types` maps exact, nonblank names to strict declarations. Use
`extends` for single-parent inheritance. Presentation fields are `stroke-width`,
`line-style`, `line-color`, `start-marker` and `end-marker`. Supply `text` and
`reverse_text` together or omit both to inherit wording. These are plain phrases,
not executable semantics.

The engine merges explicitly authored fields in this order: built-ins, the
selected shared vocabulary, then the map's declarations. It resolves parents
after merging, so parent restyling reaches descendants. Unknown parents, cycles,
invalid CSS values and changes to a built-in's destination capability are errors.
Custom descendants of `map_link` and `external_link` retain the corresponding
core destination capability; a custom name alone grants no host permission.

A known project root can contain strict JSON `lensmap.config.json` with exactly
one `types` string, naming a config-relative `.lenstypes` YAML file. That file
contains only a `connection_types` mapping. There is no ancestor search, remote
vocabulary import, executable configuration or browser filesystem discovery.
Inline declarations need no configuration file. See the
[complete declaration contract](custom-connection-types.md) and
[runnable shared example](../examples/custom-connection-types/README.md).

`pnpm schema:export` also generates
`schemas/lensmap.lenstypes.experimental.schema.json` from the owning vocabulary
Zod schema. Both exports describe structure; effective vocabulary resolution,
CSS semantics, IDs and references remain engine checks. These schemas are local,
experimental artifacts rather than new public compatibility promises.

## Validation and errors

Objects are strict at the root, node, position, reference and declaration-field boundaries. The `connection_types` mapping permits authored names; `frontmatter` alone carries opaque metadata. Unsupported fields are rejected rather than silently stripped. This deliberately describes today's supported subset, not a claim that future v1 will contain only these fields. Mixed reference/content objects, obsolete `items` wrappers, wrong field types, duplicate IDs and unknown references are errors.

The maintained YAML parser handles syntax and duplicate-key errors; unresolved tags/warnings are surfaced rather than quietly discarded. Acyclic aliases may share input data, but recursive YAML object aliases are rejected with guidance to use `node_id` for graph cycles. The parser retains its native alias-expansion protection; Lensmap adds no arbitrary source-length, node-count or graph-depth cap.

Apply is transactional from the UI's perspective: parse/validate/normalize/layout first, then replace the graph. Failure preserves the raw draft, the selected valid graph and its connections. Editing/collapsing/navigating does not re-layout the graph.

## Still incomplete

Configurable default connection types and vocabulary imports remain out of scope. Custom declarations and project vocabulary are implemented in this source checkout; see [qualification and native limits](verification/custom-connection-types.md). The supplied vocabulary and portal navigation are implemented; [default-connection qualification](verification/default-connections.md) distinguishes browser evidence from native editor evidence.

Host-specific metadata interpretation, relative coordinates, heading anchors, migration rules, import/export, durable playground saving and embedded Markdown editing assistance remain incomplete. The attached language server offers authored-ID completion in valid source and effective type-name completion while a type is being written, independently of the standalone textarea. See the editable `apps/web/src/sample.yaml` for playground input and [Zed setup](zed-browser.md) for the editor bridge.
