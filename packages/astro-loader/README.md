# @lensmap/astro-loader

Experimental `.lensmap` content collections for **Astro 7.4.0**. This release deliberately uses Astro's private `addContentEntryType` / `getRenderModule` seam and checks that exact version. It is not a stable Astro extension API. Node >=24.16 is required.

```sh
pnpm add @lensmap/astro-loader @lensmap/document astro@7.4.0
```

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import lensmap from "@lensmap/astro-loader";
export default defineConfig({ integrations: [lensmap()] });
```

```ts
// src/content.config.ts
import { defineCollection, z } from "astro:content";
import { lensmapLoader } from "@lensmap/astro-loader";
export const collections = {
  maps: defineCollection({
    loader: lensmapLoader({ base: "./src/maps" }),
    schema: z.object({
      title: z.string(),
      category: z.string().default("Notes"),
    }),
  }),
};
```

```yaml
version: v1
frontmatter:
  title: An expedition
nodes:
  - summary: Arrival
    full_text: |
      # Arrival

      The complete authored Markdown stays intact.
```

One source file becomes one native collection entry. `lensmapLoader()` is a small native `glob()` composition; it accepts `base`, `generateId`, `retainBody`, `deferRender` and an optional `pattern` (default `**/*.lensmap`). For mixed collections use `pattern: '**/*.{md,mdx,lensmap}'` or Astro's own `glob()`.

## Rendering in plain Astro

Use native `getCollection()` / `getEntry()` and `render()` from `astro:content`, then **pass the actual entry**:

```astro
---
import { getEntry, render } from 'astro:content';
const entry = await getEntry('maps', 'expedition');
if (!entry) throw new Error('Missing expedition');
const { Content } = await render(entry);
---
<Content entry={entry} />
```

The default component renders the full thought article on the server, without an extra outer heading or disclosure. It does not provide an interactive viewer and has no React or Starlight dependency.

The native document engine validates the **original source**, including its optional open-ended `frontmatter`; no frontmatter stripping or YAML reserialization occurs. Authored metadata remains separate from schema-transformed/defaulted `entry.data`. The effective entry keeps native `id` and `filePath`. Whole entries, source frontmatter and request contexts are never automatically serialized into client props.

## Markdown is inert by default

Thoughts use the consuming site's configured Markdown processor, followed by HTML sanitization. MDX expressions and imports do not execute on this path. Relative Markdown images are imported from the original map directory as inert asset URLs (the supported local image formats are AVIF, GIF, JPEG, PNG, SVG, TIFF and WebP). Host Markdown transformations run first; executable scripts/handlers and unsafe HTML are then removed. Relative hyperlinks retain authored spelling, just like native Markdown; they are not automatically graph connections. This adapter does not provide Astro image optimization for inert Markdown images.

## Explicit build-time MDX admission

Install and configure **@astrojs/mdx 8.1.0**, then admit exact local files in Astro integration options:

```js
import mdx from "@astrojs/mdx";
import { fileURLToPath } from "node:url";
// alongside the other imports above
export default defineConfig({
  integrations: [
    mdx(),
    lensmap({
      mdx: {
        admittedSources: [
          fileURLToPath(
            new URL("./src/maps/expedition.lensmap", import.meta.url),
          ),
        ],
      },
    }),
  ],
});
```

Both host MDX capability and canonical local-file admission are required. A missing configured host MDX integration is an error. Other local maps remain inert even on the same origin. Fetched sources and precompiled output never grant admission; there is no runtime MDX compiler or remote-source execution API. Source options belong in Astro configuration, **not** portable Lensmap YAML.

Admitted thoughts compile through the actual host MDX integration as virtual sibling modules of the source map: relative imports and assets resolve beside the authored `.lensmap`, not in a generated cache directory. MDX receives `props.entry` (including effective `data`, `id`, `filePath`) and separate `props.authoredFrontmatter`. Expressions such as `{props.entry.data.title}` run on the build server. Source admission is **not an import/process sandbox**. MDX diagnostics identify the virtual sibling thought module; this adapter does not remap compiler diagnostics back to YAML line positions. Only admit source controlled and reviewed by the host. Hydrated components and pre-rendered HTML are not evidence of trust. Compiled client islands require the host's own renderer/capability setup and remain ordinary Astro islands; this package does not hydrate arbitrary selected HTML snapshots.

## Custom content composition

`lensmap({ contentComponent })` accepts a resolvable Astro component module specifier or an absolute component path. A custom component receives `graph` (the engine's semantic graph), `authoredFrontmatter`, `executable` and forwarded `<Content>` props. Each thought has a named callback slot keyed by `node.key`; render it with `String(await Astro.slots.render(node.key, [entry]) ?? '')`. The callback receives the host-selected effective entry. This is how the thin Starlight layer shares compilation without making this package depend on Starlight. Only serialize deliberately chosen public graph/rendered content into an island, never arbitrary server metadata.

Generated wrapper names include a source-path hash (no same-basename collisions); identical content is not rewritten, avoiding unnecessary HMR churn. Generated wrappers live below the host's Astro `cacheDir`; authored source files are not changed.

## Development evidence

From the Lensmap workspace, after dependencies and `@lensmap/document` are built:

```sh
pnpm --filter @lensmap/astro-loader build
pnpm --filter @lensmap/astro-loader test
pnpm --filter @lensmap/astro-loader typecheck
```

The native synthetic consumer proves effective/raw metadata separation, entry-aware callback slots, relative MDX component/SVG imports, inert local image resolution, site smart punctuation, same-basename isolation, sanitization and unchanged generated-file mtimes across repeated builds. `test/site` is synthetic test source and is not shipped. Compatibility is qualified only for the exact peers above; no broad Astro-version or full client-island lifecycle guarantee is made.
