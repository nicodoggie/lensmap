# Custom connection-type declarations

## Status and relationship to existing behavior

**Consolidated design for review; not implemented.** This document records the
agreed custom-vocabulary design and makes its technical completion defaults
explicit. It does not authorize implementation or claim that the current
experimental schema accepts these examples.

The [default connection specification](default-connections.md) remains the
contract for existing thoughts, relationships, portals, navigation and host
permissions. This design adds author-defined vocabulary and presentation to
that system, not a new graph model or executable plugin mechanism.

`version: v1` remains experimental. The current
[authoring schema](../packages/document/src/v1/schema.ts) accepts only the
supplied type names and has no `connection_types` field. A future implementation
must update the owning schema, analysis and consumers together rather than
making the viewer alone accept unknown names.

## Purpose and scope

Authors can introduce named relationships, derive them from existing types and
restyle existing names. A declaration controls connector presentation and
endpoint-aware wording. Lensmap exposes that vocabulary without interpreting
its domain logic: `requires` does not enforce prerequisites, a diamond does not
imply aggregation, and a dashed line does not universally mean optionality.

Include:

- The same named declaration mapping inline and in one shared vocabulary file.
- Project-owned JSON configuration selecting that file.
- Field-by-field overrides and single-parent inheritance.
- Connector width, line presets, colour, markers and paired relationship phrases.
- Derivation from ordinary, external-link and map-link types.
- Consistent analysis, language-service and viewer interpretation.
- Live-buffer-aware reloads, useful diagnostics and last-valid-display retention.

Exclude:

- Node styling, new destination icons, custom openers or executable hooks.
- Default connection-type assignment, qualifiers or multiple inheritance.
- Simulation, inferred topology, dependency enforcement or outcome propagation.
- JS/TS configuration, vocabulary-file lists, imports or automatic remote discovery.
- Raw CSS stylesheets, arbitrary SVG, custom marker paths or a CSS-variable system.
- New filesystem/network authority, source rewriting, publication or desktop work.

An omitted connection `type` remains genuinely untyped. No configuration file,
new declaration, ID or verbose wrapper is required for ordinary notes.

## Authoring homes

### Inline declarations

A `.lensmap` document may contain an optional top-level `connection_types`
mapping alongside `version`, optional `frontmatter` and `nodes`. Its keys are the
exact names used by connection `type` and declaration `extends` values.

```yaml
version: v1
connection_types:
  reveals:
    line-style: dotted
    end-marker: arrow
    text: reveals
    reverse_text: is revealed by
nodes:
  - full_text: Investigate the archive
    connections:
      - type: reveals
        full_text: A missing page in the register
```

The declaration belongs to this document, not to a thought. The relationship
still belongs to its individual edge. Existing strings, rich thoughts,
`node_id` references, explicit empty placeholders and bare-array intermediate
thoughts retain their meaning. Prose links still do not create graph edges.

### Shared vocabulary

A `.lenstypes` file is YAML containing the same top-level `connection_types`
mapping and declaration objects. It has no `nodes`, document `version`,
`frontmatter`, executable content or second declaration syntax.

```yaml
connection_types:
  blocks_access:
    extends: prevents
    text: denies access to
    reverse_text: access is denied by
```

An empty `connection_types: {}` is valid in either home. Duplicate YAML keys
are errors, including duplicate type names and duplicate declaration fields;
there is no same-file last-wins rule. YAML aliases do not introduce another
inheritance mechanism; cyclic aliases and unsupported tags are rejected.

### Project configuration

The only project configuration in this pass is `lensmap.config.json` at the
known project root, with one required string property:

```json
{
  "types": "vocabulary/project.lenstypes"
}
```

`types` selects one vocabulary file. Relative paths resolve from the config's
directory, never the server process cwd or the currently viewed map's directory.
A project-aware host uses its explicit project/workspace root; it does not walk
above that root or discover another project's configuration. For nested workspace
folders, the most specific containing workspace folder supplies the context.

No root config means built-ins plus inline declarations. A present config must
contain a nonblank `types` path; duplicate JSON keys, unknown properties, lists,
nulls and executable configurations are errors. A missing/unreadable configured
vocabulary is an error, not permission to ignore the config. Removing the config deliberately
returns to built-ins plus inline declarations, which may then report unknown
names formerly supplied by the shared vocabulary.

Path resolution does not grant resource access. Hosts retain their file,
symlink and resource authorization boundaries. This feature is not an
unauthenticated filesystem endpoint or a reason to widen the existing bridge.
The configuration selects a file, not a glob, module, URL fetch instruction or
recursive vocabulary import.

## Declaration fields

All fields are optional. An empty declaration creates a neutral custom type or
leaves an already defined name unchanged. Unknown fields and null field values
are errors; omission and an explicit reset value are different operations.

| Field | Accepted value | Role |
| --- | --- | --- |
| `extends` | One exact built-in or custom type name | Select an inherited definition. |
| `stroke-width` | A nonnegative finite number or SVG-style CSS length/percentage value | Set the connector's base width. Zero is valid. |
| `line-style` | `solid`, `dashed`, `dotted` | Select a line preset. |
| `line-color` | `auto` or a CSS colour value | Use branch colouring or an explicit connector colour. |
| `start-marker` | `none`, `arrow`, `bar`, `circle`, `diamond` | Decorate the authored origin. |
| `end-marker` | The same marker set | Decorate the authored destination. |
| `text` | A plain relationship phrase | Read from origin to destination. |
| `reverse_text` | A plain relationship phrase | Read from destination to origin. |

Names are nonblank, exact, case-sensitive strings. Do not trim, slugify, infer a
core kind from their spelling or require a separate `name` field. A registry
must treat names as data, including names resembling JavaScript object-property
names; prototype inheritance is not vocabulary lookup.

### Wording

A declaration supplies both `text` and `reverse_text`, or neither. Validate this
pair in each authored declaration before merging layers; a forward phrase in
the shared file and a reverse phrase inline do not repair two invalid overrides.
Both omitted means inherit; both supplied means replace the pair. Style-only
overrides need neither.

The completion default is to reject blank/whitespace-only phrases. Phrases are
plain text, not Markdown, templates or expressions. The viewer supplies endpoint
names and escapes the phrases when rendering them.

Use the effective wording in inspection, explicit connection lists, keyboard
choosers and connector hover. Hover remains an additional access path, not the
only one. Inspecting from the opposite endpoint changes the phrase, not the
edge's authored direction or its drawn markers.

## Precedence and inheritance

The agreed order is **built-ins → shared `.lenstypes` → document-local
`connection_types`**. A later declaration overrides only fields it explicitly
supplies, not the entire definition. This includes an explicitly supplied
`extends`; omission retains a previously supplied parent.

Use the following resolution contract:

1. Retain the built-in seeds and their core capabilities. Merge the shared and
   local authored declarations by exact name, retaining their explicitly supplied
   fields and source provenance. Do not flatten inherited values into authored
   overrides during this merge.
2. Resolve each name against its effective parent. An explicit `extends` can
   name a built-in or custom definition, including a later declaration.
3. Without an authored parent, an existing built-in starts from its own seed;
   a new custom name starts from effective neutral `connected`.
4. Apply the name's merged explicit presentation/wording fields over that base.
   A child's own field wins over its parent's field, even when the parent's field
   was restyled in a later layer.
5. Reject unknown parents, self-extension and indirect inheritance cycles. These
   are declaration errors, not graph-cycle errors. Ordinary cyclic thought
   connections remain valid.
6. Reject any attempt to change a built-in name's fixed core link capability.
   Capability is derived internally, not an author-writable declaration field.

Restyling an existing name needs no `extends: same_name`. Self-extension does
not mean "the previous layer's definition". To return a custom type to a
neutral base, an explicit `extends: connected` can replace its earlier parent,
provided the resulting inheritance is acyclic.

Parent restyling reaches descendants unless they supply their own field. A
shared child's explicit width still wins over a document-local change to its
parent's width. A document-local width on that child wins over its shared width.
An `extends` change requires full dependent-type and destination revalidation;
it is not merely a paint update.

### Omission and resets

- Omitted field: retain its earlier explicit override or inherit from its base.
- Marker `none`: remove an inherited marker.
- Colour `auto`: return to the existing branch-colour scheme.
- Style `solid`: remove inherited dashes/dots.
- Width `0`: explicitly suppress the visible connector, not remove the edge.
- `null`: invalid; it is not a second reset language.

The untyped case is not an implicit `type: connected`. Restyling `connected`
affects explicitly named `connected` relationships and types deriving from it,
not omitted-type edges. Those keep the ordinary neutral presentation without
acquiring a configured default type.

## Connector rendering contract

### Width and CSS value context

Use the agreed scalar `stroke-width` profile: nonnegative drawing-unit numbers,
CSS lengths and SVG viewport-relative percentages, including zero. Examples are
`2.5`, `2px`, `0.15em`, `0.1rem` and `1%`. It is not a border-width shorthand or a
list. `thin`, `medium`, `thick` and `hairline` are outside this contract; do not
silently widen the authoring profile when a browser accepts additional syntax.

Self-contained CSS math is accepted only when it yields a width within that
number/length/percentage profile. Negative literal widths, non-finite numbers,
wrong dimensions and invalid syntax are errors. Computed values follow SVG/CSS
range rules; do not invent a separate expression language or evaluate JavaScript.

Define the drawing context independently of any individual thought:

- Numbers use the connector's unit-zoom SVG drawing coordinate system.
- `em` uses the viewer drawing root's base font size, not magnified node text.
- `rem` uses the host document root's font size.
- Percentages use the SVG viewport's normalized diagonal before the shared scene
  zoom, or its applied viewBox measure where applicable, never the edge length.
- Other relative CSS lengths use their standard context as resolved at that
  drawing root. Browser viewport units are not redefined as node-relative units.
- Manual scene zoom scales the line and markers together, as it does today.
  Spatial lens prominence does not independently enlarge connector width.

CSS cascade keywords such as `inherit`, `initial`, `unset`, `revert` and
`revert-layer` are rejected. Lensmap inheritance is expressed by declarations,
not accidental DOM ancestry. `var()`, `env()`, attribute substitution, declarations
with semicolons and other host-supplied substitution mechanisms are outside this
pass. CSS validation must be usable by the host-independent analysis engine;
a browser-only `CSS.supports` call is not the language server's validator.

### Colour and line presets

`auto` uses the existing target-branch colouring policy. An explicit CSS colour
changes only this connector and its markers, not either thought's branch colour,
portal icon or other incident edges. Named colours, hex, `rgb()` and `hsl()` are
examples, not a hex-only restriction. CSS colour alpha, including transparent
colours, is permitted; it does not add an `opacity` declaration field.

Resolve `currentColor` at the viewer drawing root, not the inspected thought.
Colours must be self-contained CSS colour values within that defined host
context, not paint-server URLs, external profiles or arbitrary stylesheets.
The same cascade/substitution restrictions as width apply. Invalid colours
produce diagnostics rather than an implicit return to `auto`.

`solid`, `dashed` and `dotted` are renderer-owned presets, not a raw dash-array
API. Their spacing follows connector width coherently; use round dot caps for
`dotted`. Do not infer optionality or other meaning from a preset.

### Markers, geometry and interaction

Start/end always mean the authored origin/destination, including when inspecting
an incoming edge, using a self-loop or changing view. `arrow` retains the
existing directional chevron. `bar` retains Lensmap's existing blocking marker:
**two parallel bars with a genuinely transparent gap**, not a newly introduced
single-bar replacement. Neither the connector stroke nor its halo bridges that
gap. The completion defaults for `circle` and `diamond` are outlined shapes with
transparent interiors; renderer clipping must preserve those interiors.

Marker size and clearance are renderer-owned and track the resolved stroke
width and shared zoom. Do not expose extra sizing knobs in this pass. Unmarked
ends meet the visible thought outline; marked ends reserve space for their
actual decoration. Do not retain unconditional marker padding or assume the
old fixed clearance fits every authored width.

Apply the same effective style in Lens, Overview, neighbourhoods, loops,
parallel edges and continuation stubs. Only real visible endpoints receive
markers; the faded cut end of a continuation is not a destination. Keep route
occurrences independently inspectable rather than deduplicating by name or
wording.

Focus, selection/pending emphasis, contrast halos and hit-area sizing remain
viewer-owned. Author values do not disable keyboard inspection or change
panning/travel behavior. At zero width, suppress the connector's visible stroke,
markers and halo, while retaining topology, accessible connection-list entries
and usable nonpainted hit targets. Transparent colours likewise do not delete
connections. Do not substitute a visible selection stroke for an explicitly
zero-width relationship.

## Existing link capabilities, not new thought kinds

A declaration may derive from `external_link` or `map_link`, directly or through
a custom parent. Its resolved core kind determines the existing destination
validation and activation; its custom name identifies the connector vocabulary.

```yaml
version: v1
connection_types:
  background_reading:
    extends: external_link
    line-style: dotted
    text: has background reading
    reverse_text: is background reading for
nodes:
  - full_text: Prepare the archive visit
    connections:
      - id: reference
        type: background_reading
        url: https://example.org/archive-guide
        summary: Archive guide
      - type: optional
        node_id: reference
```

The first connection has custom wording and a dotted line. Its destination keeps
the ordinary external-link icon, notes, URL handling and host-controlled opening.
The second connection stays optional and reaches that same portal; it cannot
change its destination or icon. There is no thought kind `background_reading`.

Preserve the existing source-form rules using the resolved core kind:

- A link-derived inline definition may use type plus URL without prose, including
  the existing address-fallback label and optional local content/connections.
- A link-derived starting thought is valid in top-level `nodes`, just like a
  built-in portal. There is no incoming connector there to style. Ordinary custom
  relationship types remain invalid at that position.
- An ordinary custom relationship may reference any existing thought, including
  a portal, through `node_id`.
- A link-derived reference is valid only if the target is already a portal of
  the matching core kind. It cannot redefine a URL, content or destination kind.
- A non-link definition cannot acquire a URL merely by naming itself like a link;
  mixed reference/definition fields remain invalid.

Selecting/inspecting still does not open or load destinations. Existing explicit
activation, resource bases, safe-address handling, file-opening limitations,
map navigation, missing-anchor recovery and Back/Forward behavior are unchanged.
No vocabulary styling or wording grants MDX compilation or opener authority.

## Loading, revisions and failures

### Host responsibilities

Project-aware IDE/CLI/build hosts discover the single root JSON config and load
its configured vocabulary within their authorized resource scope. The engine
receives declaration data and provenance, not a filesystem dependency or a
requirement to execute host code. A standalone/embedded browser has no implied
local-filesystem search; its host supplies the applicable declaration data before
analysis. Inline-only browser use needs no configuration.

Astro/Starlight project consumption uses the same resolution and diagnostics,
not an independent renderer interpretation or author-side copy of the vocabulary.
A static build fails on an invalid configured vocabulary or invalid dependent
map rather than shipping a silent built-in fallback. This adds no executable
content provider policy to the JSON config; existing MDX admission stays separate.

The selected vocabulary is scoped to its host project/document analysis context.
Do not make it sticky global viewer state or inject the departing map's inline
declarations into a destination map. A destination is analyzed with its own
host-provided project context and inline declarations. Back/Forward uses current
valid analysis, not a historical vocabulary rollback disguised as view restore.

### Reload transaction

A live attached config/vocabulary buffer, when available to the host, is
authoritative over its saved file. Do not claim unrelated JSON/YAML buffers for
Lensmap merely to observe configuration; qualify and document the host's actual
buffer-delivery capability.
On open/edit/close, saved-file change, configured-path change or applicable
project-context change, re-evaluate affected maps. Closing a buffer returns
loading to the saved resource. Track those dependencies without scanning
unrelated source or acquiring new source-opening authority.

Validate each authored layer, merge declarations, resolve inheritance, validate
map type uses and link destinations, then publish one consistent result. Bind
that result to the map attachment/source revision and config/vocabulary
revisions. A vocabulary-only edit can change analysis without a source-buffer
revision change; caches must not key only on the latter. Discard superseded
loads/analyses and never mix new wording with an old registry or stale bindings.

A presentation/wording-only change updates the display without moving authored
or computed node centres, resetting the camera, losing selection/history or
rewriting source. An intentional inherited-capability change is fully revalidated
before any new destination behavior is published. Preserve surviving identities
through the existing session reconciliation; do not assign authored IDs.

On a missing, unreadable or invalid configured vocabulary, invalid inheritance
or unresolved map type:

1. Retain the raw edited buffers and report useful diagnostics at the responsible
   config field, declaration or use. Include related declaration locations when
   that explains an inheritance/cross-file failure.
2. Retain the last complete valid graph **and its matching resolved vocabulary**,
   visibly marked stale. Do not publish a partially resolved map or silently
   remove custom styles/types.
3. With no prior valid result for that attachment/context, show the error and no
   fabricated graph. Failed map navigation retains the prior current map under
   the existing navigation contract.
4. On a valid correction, publish the new coherent result and clear stale state
   without discarding surviving view state.

Configuration absence is distinct from a configured file that failed to load.
No silent cwd lookup, unrelated-project search or built-in fallback repairs it.

## Shared analysis and language services

Extend the existing source schema, semantic connection/thought model, bindings
and revision-bound analysis; do not create a separate renderer registry with
more permissive validation. Keep authored type names on edges and resolved core
destination kind/address on portal thoughts independently of incoming edges.
Derived style/wording data remains analysis output, not required authored data.

Analysis, completion and hover use the same effective vocabulary. Diagnostics
for vocabulary buffers are vocabulary diagnostics, not errors that their YAML
lacks a thought-map `nodes` section. Type/parent completion offers available
exact names and hover exposes effective wording/base and useful source
provenance. Preserve existing diagnostics and ID/reference features.

Generate structural JSON Schema from the owning Zod input schemas. Standalone
map schemas must allow structurally valid custom names; a closed built-in enum
cannot validate project-defined vocabularies. Encode local structural constraints,
including paired phrase fields, in those schemas. Cross-file name resolution,
cycles and effective destination compatibility remain owned semantic checks.
Do not claim that static JSON Schema alone resolves another file or the
effective vocabulary.

Send only deliberately selected effective definitions/identity information to
the viewer. Do not serialize entire config/loader objects, private filesystem
paths or executable-content provider settings. Viewer memoization, graph-delta
projection and transport must preserve the new data and its revision identity.

## Complete shared/local override example

At the project root, `lensmap.config.json` contains:

```json
{
  "types": "vocabulary/project.lenstypes"
}
```

`vocabulary/project.lenstypes` contains:

```yaml
connection_types:
  prevents:
    stroke-width: 2px
  blocks_access:
    extends: prevents
    text: denies access to
    reverse_text: access is denied by
```

A map in that project contains:

```yaml
version: v1
connection_types:
  prevents:
    stroke-width: 4px
  blocks_access:
    line-style: dotted
nodes:
  - full_text: The archive closes
    connections:
      - type: blocks_access
        full_text: Read the original register
```

The resulting edge is dotted, four pixels wide before scene zoom and has the
inherited blocking marker at the destination. It retains the shared paired
wording. The map's child override did not erase `extends` or the wording; the
parent's effective local width reached the child because that child supplied no
width of its own. Adding `stroke-width: 3px` to the shared `blocks_access`
declaration would instead make that child's width three pixels; its own explicit
field wins over an inherited parent field.

## Explicit technical completion defaults

These are reviewable completion rules, not claims of additional prior product
approval or implemented behavior:

- Nonblank exact names/wording, strict known fields, duplicate-key errors and no
  null-reset semantics avoid guessed normalization or same-layer last-wins rules.
- Resolve parent references after layering while retaining only authored fields
  as overrides; built-in seeds and core capabilities are separate resolver data.
- Neutral new names derive from effective `connected`; omitted edge types do not.
- Width is the selected scalar SVG-style profile, with a defined drawing-root
  context and no CSS cascade/custom-property language.
- `bar` preserves the existing double-bar glyph; new circle/diamond presets are
  outlined. Zero-width suppresses visible connector paint but not its routes.
- Config discovery is root-bounded; context/revision changes invalidate analysis
  even if map source is unchanged. No valid prior result means an error/empty
  state, not invented content or a silent vocabulary fallback.

## Acceptance requirements for a future implementation

These are proposed qualification gates, not completed test results.

| Area | Required evidence |
| --- | --- |
| Progressive authoring | Existing shorthand, placeholders, references, source text and topology are unchanged; inline-only maps need no config. |
| Declaration structure | Both homes use the same mapping; reject duplicate keys, unknown fields, nulls and malformed values at useful ranges. |
| Resolution | Exercise all three layers, partial overrides, explicit resets, parent restyling, forward/custom parents and child-owned fields winning over inherited values. |
| Resolution failures | Reject missing parents, direct/indirect cycles, incomplete phrase pairs in each layer and core-capability changes; graph cycles remain valid. |
| Value profile | Qualify unitless/absolute/relative/percentage/zero widths, CSS colours and all line presets; reject negative literals, non-finite values, cascade/substitution and arbitrary CSS/SVG input. |
| Actual painting | Render every marker at both ends, loops, parallel edges and visible continuation ends; inspect transparent gaps/interiors, marker-aware clipping and width/zoom consistency. |
| Untyped semantics | Restyling `connected` does not assign a default type or change omitted-type presentation. |
| Link derivation | Exercise custom external/map types inline, at roots and in compatible references; ordinary relations may reach portals without changing their destinations/icons. |
| Interaction | Endpoint-aware wording is accessible by pointer, keyboard and touch paths; hidden/zero-width paint does not remove routes, steal focus or break drag/pan. |
| Project loading | Root/config-relative selection works independently of cwd; live buffers win; close/save/path/context changes reload only affected maps; absent config and broken configured files differ. |
| Failure/recovery | Invalid shared or local edits preserve matching last-valid graph/vocabulary and visibly stale state; correction recovers; superseded async work cannot publish. |
| Revisions/layout | A vocabulary-only change reaches transport, projections, hover and lists at the same map source revision without resetting view or node positions. |
| Native consumers | Use the actual standalone/embedded viewer, installed language-server bridge and native Astro/Starlight hosts, not only schema or export mocks. |
| Packaging | If public packages change, qualify the actual retained pnpm tarballs and installed consumers; this spec itself neither changes versions nor authorizes publication. |

Use focused resolver/analysis tests, generated-schema checks and existing native
consumer/browser tooling. Do not build a parallel acceptance framework or treat
this checklist as self-certifying runtime evidence.

## Review and implementation boundary

Review this consolidated specification, particularly its explicitly marked
technical defaults, before creating the implementation plan. Implementation,
new package releases, broader host permissions and new node/navigation behavior
are not authorized by writing or committing this document.

References for the selected width model:
[SVG stroke-width](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-width)
and [CSS stroke-width context](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/stroke-width).
The explicitly selected Lensmap value profile above governs this design rather
than automatically adopting every newer CSS draft feature.
