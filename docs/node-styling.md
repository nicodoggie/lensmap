# Node styling

## Implementation contract

This implements the initial node-styling discussion. Styling is presentation,
not a node ontology or a change to connection types, navigation or permissions.
Animations, keyframes, selectors and separate icon/background animation targets
are deferred; a swirling portal is a future use case, not this slice.

A rich node accepts optional `classes: string[]` and `style`. References retain the
appearance of their target; a `node_id` occurrence cannot restyle that target.
Strings and unstyled documents keep their existing behavior. Classes do not
propagate through graph edges or authored nesting.

`style` accepts either a CSS declaration string or an insertion-ordered YAML
mapping of CSS property names to string/finite-number values. Both forms use the
same parser and CSS value grammar. Numbers are not implicitly converted to px.
Preserve authored source, declaration order, shorthand/longhand interactions and
CSS `!important` priority. Duplicate YAML keys are errors; repeated CSS
declarations are available in the string form.

Top-level `node_styles` maps class names to either style form. This is a named
rule dictionary, not a CSS selector language. All class rules have equal
specificity and apply in their declaration order in `node_styles`, independent
of the order of names in `classes`. Inline declarations have higher specificity;
important declarations beat normal declarations across both origins. Unknown
classes and invalid/unsupported declarations produce source-located diagnostics
and retain the last valid graph with the normal stale indication.

### Initial CSS profile

- `color`, `background-color`.
- `font-family`, `font-size`, `font-weight`, `font-style`, `line-height`.
- `border`, `border-color`, `border-width`, `border-style`, their directional
  longhands, and `padding`/directional padding longhands.
- `--lensmap-scale`: a finite positive unitless number, or `auto`. Omission uses
  the current default circle. Numbers multiply the default circle diameter.
  `auto` starts at that diameter and grows the bubble to fit its rendered summary
  at the normal font size, including padding and icons; it never shrinks text.
- `--lensmap-icon`: a CSS string or a plain text/emoji mapping value. Decorative
  icons supplement rather than replace mandatory destination indicators.

Use the installed maintained `css-tree` grammar. Reject unknown properties,
unsafe token constructs, resource loading (`url`, image functions), CSS-wide
inheritance/reset keywords, unresolved `var`/`env`/`attr`, executable/HTML content,
and nonfinite/negative lengths where disallowed. Unsupported features are errors,
not silently ignored declarations. Fonts name host-available families and do not
install or fetch fonts. Style text is parsed as declarations, never inserted as
an untrusted stylesheet. Text/colour values remain inert data.

The initial profile does not accept CSS math functions (`calc`, `min`, `max`,
`clamp`). Standard supported colour functions, including `light-dark`, retain
their native grammar; negative hue/channel components are not negative lengths.
Standard property names are case-insensitive; custom property names are exact.

### Geometry and view ownership

Authored size is independent of spatial lens magnification and camera zoom.
The viewer owns browser font/Markdown measurements and resolved base radius.
The actual rendered summary, not raw Markdown punctuation or full expanded
prose, determines `auto` fitting. Include icon, border and padding measurements.
Wait for available fonts and remeasure when their availability changes.

Project the resolved radius into automatic layout clearance, neighbourhood rings,
Overview extents, lens collision limiting, loops, both connector endpoints,
continuation stubs and native hit bounds. Preserve explicit authored coordinates.
Paint-only edits preserve coordinates, camera and selection. Geometry changes
may recompute automatic placement but must not silently move authored pins.
Pan/zoom must not initiate world-layout recomputation.

Author styles must not erase keyboard focus, selection/target cues or portal
capability indicators. Apply node styles only within the viewer; do not style the
host page or expanded host-rendered Markdown prose.

### Engine/viewer seam

`Thought.style?: NodePresentation` carries resolved presentation through normal
semantic snapshots, the LSP bridge and Astro/Starlight data. Export:

- `NodeStyleDeclaration = { property: string; value: string; important: boolean }`.
- `NodePresentation = { declarations: NodeStyleDeclaration[];
  scale?: number | "auto"; icon?: string }`.

The declaration list retains standard-property order and priority. `scale` and
`icon` are the effective custom-property values; geometry remains a viewer
concern. Custom declarations may remain in the list, but the renderer must not
allow raw declarations to replace its own positioning/transform controls.

## Qualification

Focused RED/GREEN engine tests cover both syntax forms, order/priority, classes,
CSS validation, source ranges, stale recovery and prepared content edits.
Viewer unit/browser evidence covers fixed/default/auto sizes, styled Markdown,
icons, geometric endpoints, large-node Overview/neighbourhood/loops, paint-only
updates and source preservation. Existing source-browser, native framework and
installed-tarball acceptance must remain green. Native Zed UI, other browser
engines, physical touch comfort and large-graph performance are not implied.

### Verified implementation checkpoint

The engine, shared viewer, language-server snapshots and Astro/Starlight paths
implement this profile. The generated experimental JSON Schema includes both
style forms. See the self-contained
[node-styling example](../examples/node-styling/README.md) for a checkout launch
route and authoring examples. This is not yet a published npm feature.

Qualification from `/home/ensu/Projects/lensmap`:

- `pnpm check` passed all 15 tasks: repository lint, release-script tests,
  script/workspace typechecks, owning tests and builds. Existing template-style
  informational notices and the web bundle-size advisory remain non-blocking.
- `pnpm test:e2e` passed all 43 Chromium tests. Styled-node tests use native
  rendered Markdown, computed font and circle dimensions, both connector ends,
  a styled continuation origin, paint-only updates, temporary-view return and
  restored-neighbourhood return. Desktop and synchronized narrow captures were
  inspected.
- `pnpm test:packages` passed with all four production tarballs installed in an
  isolated consumer: public declarations, native Astro/Starlight production and
  dev/browser behavior, executable/settings and the installed bridge tests.
- Independent whole-feature review found a hidden auto-radius cache lifecycle
  defect. A browser regression reproduced a 290px bubble returning at 86px.
  The correction retains hidden measurements, prunes removed/non-auto nodes and
  measures newly mounted summaries before paint; focused spec/quality recheck
  passed. Parent verified all 28 feature files against the review candidates.
- Native Starlight acceptance also caught measurement of temporary selection
  borders; measurement now excludes those cues. Full-suite fixture qualification
  caught mixed test/production JSX modes; fixture builds now set and restore
  their environment explicitly. The successful full browser run follows both
  repairs, rather than treating earlier partial runs as acceptance.

Logs and bounded review reports are retained locally under
`artifacts/checkpoints/node-styling/`. Measurement uses host-available fonts,
a 260px maximum natural measurement width and conservative rectangular-diagonal
circle fitting. Automatic subtree planning conservatively uses the largest
radius, which can leave extra space in mixed-size graphs. Hidden changed content
keeps its prior radius only until remount and remeasurement. No fresh native Zed
UI, Firefox/WebKit, physical touch or large-graph performance qualification is
claimed. Animations and external style/font loading remain outside this slice.
No package version bump, push or publication was performed.
