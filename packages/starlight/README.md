# @lensmap/starlight

Experimental Starlight composition for Lensmap documents. Qualified against **Astro 7.4.0**, **Starlight 0.42.6**, **@astrojs/react 6.0.6**, and **React / React DOM 19.3.1**. Its loader's private Astro content seam is checked and deliberately version-bound. Node >=24.16 is required.

```sh
pnpm add @lensmap/starlight@next @lensmap/astro-loader@next @lensmap/document@next \
  astro@7.4.0 @astrojs/starlight@0.42.6 @astrojs/react@6.0.6 react@19.3.1 react-dom@19.3.1
```

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import react from "@astrojs/react";
import lensmap from "@lensmap/starlight";
export default defineConfig({
  integrations: [starlight({ title: "My notes" }), react(), lensmap()],
});
```

```ts
// src/content.config.ts
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
export const collections = {
  docs: defineCollection({
    loader: glob({
      pattern: "**/*.{md,mdx,lensmap}",
      base: "./src/content/docs",
    }),
    schema: docsSchema(),
  }),
};
```

Keep `frontmatter.title` and any host schema fields in the `.lensmap` source. Native collection validation/defaults, routes, generated navigation, draft exclusion and searchable static content continue to belong to Astro/Starlight. **The stock Starlight docs loader does not include `.lensmap` automatically**: use the mixed native glob above, or compose the host's current loader deliberately. Do not silently replace custom ID/localization behavior with this minimal example.

`lensmap(options)` forwards loader execution options. Starlight installs its MDX integration; execution still requires explicit `mdx.admittedSources` in this integration. See `@lensmap/astro-loader` for the trust boundary. Default Markdown stays inert and inherits site processing; same origin or precompiled HTML never grants execution permission.

## Host-owned sidebar composition

This package does **not** replace host panels, TOC or component overrides automatically. Extend the host's existing `PageSidebar` override, using these supported package components:

- `@lensmap/starlight/components/SidebarShell.astro`: `mobile-panels`, `mobile-inspector`, `mobile-toc`, `context-panels`, `inspector`, `toc` slots.
- `@lensmap/starlight/components/LiveInspector.astro`: desktop inspector mount.
- `@lensmap/starlight/components/MobileThoughts.astro`: independent, initially closed native **Thoughts** disclosure, using Starlight's public `Icon` / `right-caret`.
- `@lensmap/starlight/components/MapContent.astro`: normally selected by the integration, usable for explicit composition.

A minimal override, retaining ordinary-doc behavior:

```astro
---
import DefaultPageSidebar from '@astrojs/starlight/components/PageSidebar.astro';
import Shell from '@lensmap/starlight/components/SidebarShell.astro';
import Inspector from '@lensmap/starlight/components/LiveInspector.astro';
import Thoughts from '@lensmap/starlight/components/MobileThoughts.astro';
const isMap = Astro.locals.starlightRoute.entry.filePath?.endsWith('.lensmap');
---
{isMap ? (
  <Shell>
    <div slot="context-panels"><!-- Your existing host panels --></div>
    <Inspector slot="inspector" />
    <Thoughts slot="mobile-inspector" />
    <div slot="mobile-panels"><!-- Your existing mobile panels --></div>
    <div slot="toc"><!-- Your existing host TOC composition --></div>
  </Shell>
) : <DefaultPageSidebar {...Astro.props} />}
```

For a host override already composing panels/TOC, insert these mounts into that override rather than copying private Starlight controllers or IDs. Starlight can gate its entire right rail when TOC is disabled; this package does not fabricate headings or override that route policy. If you disable the rail, supply an explicit alternative mount. `inspectorId` on mounts and `<Content>` defaults to `default`; use matching unique IDs when deliberately composing multiple map sessions on one page. The normal native docs route renders one map/session.

## Preserved viewer/reading behavior

The package build bundles the **existing Lensmap Viewer, ViewerConnections and layout/session implementation** into `dist`. It does not reimplement graph geometry or depend at runtime on the private web workspace. Semantic graph colors and readable node foregrounds remain viewer-owned; neutral chrome follows real Starlight tokens and inherited fonts.

The inspector portals into the responsive mounts from one live viewer session. Shared outgoing/incoming relationship wording, disclosures, empty states and focus callbacks are retained. Short thoughts are shown in full. Long thoughts get a text excerpt and accessible Show more/Show less; the original prepared HTML is genuinely hidden while collapsed, expands in normal page flow and resets on selection. No nested note scrollbar is added. Map-only desktop rails use natural height; ordinary docs retain native behavior.

Only the interactive viewer is inside `not-content`, keeping host prose spacing out of graph coordinates. The lower full article is server-rendered, always visible without JavaScript, in normal prose flow, with **no generated outer All thought content heading or disclosure**. Authored headings and summaries are not deduplicated or rewritten.

The mobile disclosure is independent of host panels/TOC. Changing selection does not force it open or scroll it. It uses native summary activation, not Escape/outside-auto-close behavior.

## Optional rendered connection labels

For custom React compositions, `@lensmap/starlight/viewer` exports the bundled `ViewerHost` (default), `ViewerHostProps`, `GraphData` and `GraphNode` types. Import `@lensmap/starlight/viewer.css` once. Its `getLabel(node)` callback customizes only connection labels; shared directional algorithms remain unchanged. The default extracts a heading from already-rendered thought HTML. Supply callbacks inside a host React component, not as serialized Astro island props.

Prepared selected HTML is an HTML snapshot, not a second Astro island hydration root. Admitted MDX renders natively in the static article; this release does not promise independent hydration/lifecycle of arbitrary client components copied into the selected inspector. No metadata/request contexts are serialized by default: the island receives public laid-out graph data (without raw Markdown), prepared thought strings and a mount ID.

## Verification

After workspace dependencies, document and loader builds:

```sh
pnpm --filter @lensmap/starlight build
pnpm --filter @lensmap/starlight typecheck
pnpm --filter @lensmap/starlight test
```

The synthetic native Starlight build/Playwright test covers no-JS full reading, actual MDX entry data, draft exclusion, metadata-free island props, live directional navigation, long/short prose and selection reset, closed mobile behavior/caret, host panel independence, Starlight light/dark changes, geometry alignment at desktop/intermediate/mobile widths and ordinary docs. Tests use the workspace's Playwright/Chromium tooling; no browser or BF content ships in this artifact.
