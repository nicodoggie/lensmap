# Lensmap website

Private Astro/Starlight workspace for the interactive homepage and conventional
public documentation. It uses the existing document engine and source-level shared
viewer; it is not another published package or a second renderer.

## Run locally

From the repository root with Node 24.16+ and the pinned pnpm:

```sh
pnpm install --frozen-lockfile
pnpm exec turbo run build --filter=@lensmap/site
pnpm --filter @lensmap/site preview --host 127.0.0.1 --port 4321
```

Open <http://127.0.0.1:4321/lensmap/>. Docs are at
<http://127.0.0.1:4321/lensmap/docs/>. Direct routes, assets and search use the
project base, not the origin root.

For development, build the workspace dependencies once as above, then run:

```sh
pnpm --filter @lensmap/site dev --host 127.0.0.1 --port 4321
```

The native dev server updates authored maps, styles and docs. The production
preview serves the last build; rebuild before checking edited output.

## Check

```sh
pnpm --filter @lensmap/site test
pnpm --filter @lensmap/site typecheck
pnpm exec turbo run build --filter=@lensmap/site
pnpm --filter @lensmap/site test:e2e
```

The browser suite starts its own loopback preview on port 4321, refuses an existing
server and tears down the server it owns. Stop a manually running preview first.
Install Chromium with `pnpm exec playwright install chromium` if needed. The root
`pnpm check` includes this workspace's tests, typecheck and build. Biome's local
Astro overrides follow the existing adapters: its frontmatter-only unused-symbol
analysis cannot see template references; Astro's native checker owns the template.

## Source and presentation

- `src/maps/hero.lensmap` owns thought copy, destinations, styles and desktop pins.
- `src/hero.ts` initializes a measured site-owned view; its narrow composition
  does not edit the authored source. Subsequent resize preserves exploration.
- `src/pages/index.astro` provides metadata and a no-JavaScript fallback.
- `src/content/docs/docs/` contains conventional Starlight Markdown/MDX pages.
- `src/components/MapExample.astro` analyzes one source and passes that same source
  to Starlight's copyable code component. `src/maps/example.lensmap` is the live
  demonstration, not a separately maintained diagram.
- Hero overrides are site-scoped. Other viewer consumers and npm packages are
  unchanged.

## Deploy — separate approval

`.github/workflows/pages.yml` prepares the native Pages build, browser acceptance,
artifact upload and deployment jobs. It supports manual dispatch and qualifying
site/dependency changes on `main`. GitHub Pages must be configured to use GitHub
Actions; its environment protections remain a repository-owner decision.

Local implementation does **not** authorize pushing, enabling Pages or dispatching
a deployment. The intended URL is <https://nicodoggie.github.io/lensmap/>; that
address is not a claim of live availability. After an approved deployment, verify
that URL, a direct docs route, generated assets, search and a hydrated example.
