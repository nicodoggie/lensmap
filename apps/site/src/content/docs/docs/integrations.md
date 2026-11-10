---

title: Embed in Astro and Starlight
description: Use Lensmap in a static site without moving host responsibilities into maps.
sidebar:
  order: 6
---

## Install a matching cohort

```sh
pnpm add @lensmap/document@0.3.0 @lensmap/astro-loader@0.3.0 @lensmap/starlight@0.3.0
pnpm add astro@7.4.0 @astrojs/starlight@0.42.6 @astrojs/react@6.0.6 \
  react@19.3.1 react-dom@19.3.1
```

The framework seam is experimental and version-bound. Use the qualified versions
rather than assuming compatibility with every Astro release.

## Configure Starlight

```js
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import react from "@astrojs/react";
import lensmap from "@lensmap/starlight";

export default defineConfig({
  integrations: [starlight({ title: "My notes" }), react(), lensmap()],
});
```

The stock Starlight loader does not include `.lensmap` automatically. Use the
[native mixed-content collection example](https://github.com/nicodoggie/lensmap/tree/main/packages/starlight#readme)
to include Markdown, MDX and map routes. Host frontmatter, navigation, drafts,
search and ordinary docs remain the site's responsibility.

## Compose, do not take over

The integration supplies a live map and static readable thought content.
Optional sidebar mounts compose with host TOCs and panels. The site retains
control of inspector placement, mobile presentation and ordinary CSS theming.
A map's node styles do not style the containing website.

## Content and resource boundaries

Plain Markdown is inert by default. Executable map content requires an explicit
provider and separately admitted source in host configuration. A map cannot grant
itself trust, and same origin is not execution permission. Static generation is
not a sandbox: a trusted build can execute code and emit client assets.

Fetched runtime maps remain raw YAML with non-executable Markdown. The host owns
resource loading, source-base resolution and external opening. A browser still
obeys CORS and cannot silently read local files.

See [Astro loader setup](https://github.com/nicodoggie/lensmap/tree/main/packages/astro-loader#readme)
and [Starlight composition](https://github.com/nicodoggie/lensmap/tree/main/packages/starlight#readme)
for full configuration and the current fidelity limits.
