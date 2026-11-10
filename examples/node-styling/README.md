# Node styling example

`map.lensmap` is self-contained: reusable classes, inline mapping and CSS text,
a numeric circle scale, a summary-fitted circle, decorative icons and a portal
to another thought in the same document. No project configuration is needed.

## Open the source-checkout viewer

From the repository root:

```sh
pnpm --filter @lensmap/document build
pnpm --filter @lensmap/web dev --host 127.0.0.1
```

Use the local address Vite prints, with
`/?map=/node-styling/map.lensmap` appended. The development runner serves the
repository's examples directory; production build/preview does not publish it.
Alternatively, paste the file into the playground's YAML source and Apply, or
open it using the local editor-bridge runtime described in
[Zed setup](../../docs/zed-browser.md).

## What to notice

- `important` supplies colour, a border, a host-available font stack and a larger
  base circle. `tentative` is declared later, so its dashed border wins even
  though `classes` lists the names in the opposite order.
- `style` overrides classes with CSS inline specificity; `!important` still has
  its standard higher priority. String and mapping forms share CSS validation.
- `spacious` uses `--lensmap-scale: auto`: the **circle grows**, not the text
  shrinking. Only the rendered summary is fitted, not expanded `full_text`.
- A decorative icon supplements, not replaces, the built-in portal indicator.
- Reusing `hypothesis` via `node_id` reuses its style; classes do not spread along
  edges or turn into relationship types.

See [the styling contract](../../docs/node-styling.md) for the supported CSS
profile and intentionally unsupported features. Maps do not load external CSS,
fonts or executable animation code. This functionality is published in the
[0.3.0 npm cohort](../../docs/releases/0.3.0.md); the development launch route
above still uses the checkout and does not publish the example files.
