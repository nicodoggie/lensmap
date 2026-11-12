# Responsive node styling and authored positioning

## Status and goal

Approved by Nico on 2026-11-12 and implemented locally, without publication.
Verification receipts are retained under `artifacts/checkpoints/`. Shared CSS
positioning and conditional presentation serve ordinary viewers, the website
and the LSP browser preview. The authoring and precedence defaults below govern
this slice.

Goal: edit a map's responsive layout in its source and see the same authored
arrangement in the site and editor preview under equivalent viewing conditions,
without a site-specific table of node IDs and replacement coordinates.

JS/TS-driven controls or host-aware preview customization may be useful later.
Their design is deliberately left open; they are not required or authorized by
this slice. Ordinary fetched map data remains non-executable.

## Authoring proposal

Extend the existing CSS strings in inline `style` and named `node_styles` rules.
Permit nested `@media` and unnamed size `@container` blocks containing supported
node declarations. No new top-level stylesheet field, selector language or
mobile/desktop YAML vocabulary is needed for this first slice.

Existing declaration strings and YAML property mappings remain valid. Conditional
blocks use the CSS-string form; the mapping form stays a property/value shorthand,
not a second conditional language. Equivalent ordinary declarations retain their
existing semantics in both forms.

Example of the supported declaration-string form:

```yaml
version: v1
node_styles:
  entry: |
    --lensmap-x: -820;
    --lensmap-y: -120;
    @container (width < 700px) {
      --lensmap-x: 0;
      --lensmap-y: -550;
    }
    @media (prefers-color-scheme: dark) {
      color: #e8eee2;
    }
nodes:
  - summary: Documentation
    type: external_link
    url: docs/
    classes: [entry]
```

### Position semantics

- `--lensmap-x` and `--lensmap-y` accept finite unitless numbers in the existing
  authored world-coordinate system, including negative values, or `auto`.
  These are layout inputs, not CSS pixel offsets or post-projection transforms.
- Existing `position: {x, y}` supplies fallback coordinates. A winning CSS
  coordinate overrides that axis; an omitted CSS axis retains its fallback.
  Without an authored fallback, the omitted axis remains automatic.
- Explicit CSS `auto` releases that axis to automatic layout, including when an
  existing `position` would otherwise pin it. One axis may be pinned while the
  other remains automatic; do not invent or silently pin an unprovided axis.
- Positions resolve before automatic placement, radius/clearance handling and
  lens projection. Connectors, Overview bounds, neighbourhood entry/return and
  hit targets consume the same resolved geometry.
- Camera, uniform zoom, lens strength, selected thought and temporary exploration
  are view state, not authored node-position properties.

### Conditions and cascade

- `@media` retains normal browser media semantics: width/height refer to the
  browser viewport, not a renamed map-container size. Use the browser's media
  matching and change notifications rather than a second hand-written matcher.
- `@container` size conditions refer to this viewer's own map canvas. A narrow
  embedded viewer can therefore adapt inside a wide browser window. Named host
  containers, style queries and scroll-state queries are outside this slice.
- Use maintained CSS parsing for condition structure and supported at-rules.
  Qualify native browser evaluation of container conditions as an opening
  implementation task; do not promise a custom matcher or change the host's
  intrinsic layout merely to make query evaluation convenient.
- Nested conditions combine their requirements. Conditional blocks add no
  specificity: retain named-rule source order, inline specificity, declaration
  order and `!important` priority from the existing styling contract.
- Preserve rule/declaration provenance and source ranges. Invalid declarations
  are diagnosed even in a currently inactive branch. Malformed or deliberately
  unsupported constructs retain the last valid presentation with diagnostics;
  never silently drop the invalid branch to produce a partial successful map.
- Reevaluate when the relevant media environment or canvas changes. Relayout
  only when effective position or measured size changes, not on every resize
  notification or paint-only condition change. Pan, zoom and lens movement do
  not affect condition matching or trigger authored-layout recomputation.
- Preserve selection and the user's camera across responsive changes. If a
  selected thought moves, it is not permission to start an automatic camera tour
  or reset navigation/history. Leaving a condition restores the applicable base
  presentation rather than retaining stale conditional coordinates.

## Shared implementation boundaries

The document engine validates and retains an ordered, serializable conditional
presentation program. It does not choose a viewport or evaluate browser media.
The same program must survive the LSP bridge and Astro/Starlight serialization;
server-side rendering must not discard conditions by assuming desktop dimensions.

The shared browser viewer resolves effective presentation and geometry using its
own environment. Existing measured auto-sizing remains authoritative; responsive
fonts, padding or scale cannot become paint-only changes that leave connectors
attached to old circles. Existing layout reuse must account for effective pins
and radius, while leaving world placement stable on camera navigation.

The site hero then replaces its portrait ID/coordinate override with authored
conditional styling. Its initial framing must consume the shared resolved
geometry. Site-specific camera/lens policy can remain, but there must not be a
second site-only conditional-style resolver.

## Safety and scope boundaries

Preserve the current supported declaration/resource policy, native CSS value
grammar and exact custom-property case. Conditions do not authorize `@import`,
resource loading, arbitrary selectors, host-page styling, keyframes, executable
content or raw unvalidated stylesheet injection. Any generated browser rules
must be compiled from validated structures and scoped to the owning viewer.

This work does not implement a JavaScript/TypeScript map module loader, new
trusted-source admission rules, dynamic-control scripting, a manual positioning
editor, print/export tooling or a new global theme system. It does not authorize
an npm release, website push/deployment or edits to unrelated projects.

## Acceptance and stop rule

1. Extend existing parser/cascade tests to cover conditional source order,
   important/inline precedence, bad inactive branches and exact error ranges;
   preserve ordinary string/mapping and class behavior.
2. Verify base, conditional and released/automatic coordinate axes through actual
   layout. Keep authored fallback pins and automatic descendants correct.
3. Reuse existing viewer/bridge browser fixtures: edit a conditional position in
   a live map buffer, change matching conditions, and verify geometry updates
   without losing the draft, selected thought, camera or map history.
4. Exercise a narrow viewer inside a wide page separately from a narrow browser.
   Verify a representative native media preference change and condition removal.
   Check connectors/hit geometry and auto-sized text after responsive changes.
5. Use the same authored hero through the site and LSP preview path; confirm the
   responsive coordinate table is no longer in site TypeScript. Inspect desktop
   and narrow captures. Preserve any concurrent user source edits.
6. Typecheck/build owning packages and consumers. Reuse existing native
   framework/package acceptance where the changed serialization/public-type
   boundary requires it; do not create a second disposable framework.

Stop after the shared declarative loop and hero dogfood are qualified. Dynamic
JS/TS preview integration remains a separate design, not a hidden prerequisite.
