---

title: Style thought bubbles
description: Reusable classes, content-fitting circles and responsive layouts.
sidebar:
  order: 5
---

Styling is presentation, not a node ontology. Classes do not spread along edges
or through nesting, and references retain their target's appearance.

## Reuse a class; override it locally

```yaml
version: v1
node_styles:
  "*":
    font-family: "system-ui, sans-serif"
    color: "#e7eef4"
  clue:
    background-color: "#3b3430"
    color: "#fff1cd"
    border: "2px solid #d4ae68"
    --lensmap-scale: 1.4
nodes:
  - full_text: A forgotten footpath
    classes: [clue]
  - summary: An uncertain recollection
    style: "color: #b5e6d2; border-style: dashed;"
```

A style can be a CSS declaration string or an ordered YAML mapping. Named rules
follow their declaration order in `node_styles`, not the order of names in
`classes`. Inline declarations have higher specificity; CSS `!important` keeps
its priority. Repeated CSS-string declarations are allowed; duplicate YAML keys
are errors.

The quoted `"*"` rule supplies defaults to **every node**, even shorthand strings
and nodes without `classes`. Named classes override normal defaults; inline
styles have higher specificity still. `!important` keeps its priority across all
three levels. The default applies first regardless of its dictionary position,
and does not need to be listed in a node's `classes`.

This is a reserved default rule, not a general CSS selector or glob language.
It styles nodes in this document, not the toolbar, inspector or host page.

## Make room for a longer summary

```yaml
version: v1
nodes:
  - summary: A longer thought that deserves room to breathe
    style:
      --lensmap-scale: auto
      font-size: 18px
      padding: 16px
      --lensmap-icon: "✦"
```

A numeric `--lensmap-scale` multiplies the default circle. `auto` grows a circle
around its rendered summary at the normal font size; it does not shrink the
text. Expanded prose does not determine that summary's size. Base sizing remains
separate from spatial lens magnification and camera zoom.

## Position and adapt a thought

```yaml
version: v1
nodes:
  - summary: Documentation
    style: |
      --lensmap-x: 320;
      --lensmap-y: 0;
      @container (width < 700px) {
        --lensmap-x: 0;
        --lensmap-y: 260;
        font-size: 24px;
      }
      @media (prefers-color-scheme: dark) { color: #e8eee2; }
```

Coordinates are unitless map-world coordinates, before lens deformation and zoom,
not CSS pixel offsets. CSS coordinates override the corresponding `position`
axis; omission keeps its fallback, and explicit `auto` releases an axis to
automatic layout.

`@container` measures this map's canvas, including a narrow map inside a wide
page. `@media` uses normal browser viewport/preferences. Nest either block in an
inline CSS string or named class; conditional nesting combines its requirements
without changing cascade specificity. Use CSS strings for conditional rules, not
special YAML media keys. Invalid inactive branches still produce diagnostics.

The site and editor preview use the same shared resolver. Camera and selection
survive responsive changes; panning and zooming do not change rule matching.

## A deliberately limited CSS profile

The initial subset includes foreground/background colours, host-available font
families and text properties, borders, padding, `--lensmap-scale` and decorative
`--lensmap-icon`, plus the coordinate properties above. Numeric CSS values do not
automatically become pixel lengths. Container queries are unnamed size queries;
named host containers and style/scroll-state queries are not supported.

Unknown properties, external resources, unresolved variables, CSS-wide reset
keywords and unsupported constructs produce diagnostics. Maps cannot inject a
stylesheet into the host page or install fonts. Keyframes and animation are not
part of this release. Decorative icons do not replace portal indicators.

The sidebar, toolbar and surrounding page are ordinary HTML: style those with
the host's actual CSS, separately from map-authored node presentation.
See the [supported profile](https://github.com/nicodoggie/lensmap/blob/main/docs/node-styling.md).
