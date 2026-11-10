---

title: Style thought bubbles
description: Reusable classes, inline CSS and content-fitting circles.
sidebar:
  order: 5
---

Styling is presentation, not a node ontology. Classes do not spread along edges
or through nesting, and references retain their target's appearance.

## Reuse a class; override it locally

```yaml
version: v1
node_styles:
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

A style can be a CSS declaration string or an ordered YAML mapping. Class rules
follow their declaration order in `node_styles`, not the order of names in
`classes`. Inline declarations have higher specificity; CSS `!important` keeps
its priority. Repeated CSS-string declarations are allowed; duplicate YAML keys
are errors.

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

## A deliberately limited CSS profile

The initial subset includes foreground/background colours, host-available font
families and text properties, borders, padding, `--lensmap-scale` and decorative
`--lensmap-icon`. Numeric CSS values do not automatically become pixel lengths.

Unknown properties, external resources, unresolved variables, CSS-wide reset
keywords and unsupported constructs produce diagnostics. Maps cannot inject a
stylesheet into the host page or install fonts. Keyframes and animation are not
part of this release. Decorative icons do not replace portal indicators.

The sidebar, toolbar and surrounding page are ordinary HTML: style those with
the host's actual CSS, separately from map-authored node presentation.
See the [supported profile](https://github.com/nicodoggie/lensmap/blob/main/docs/node-styling.md).
