# Lensmap GitHub Pages site

## Status and goal

Nico approved the conversational design on 2026-11-11. This document records that
agreement and the reviewable implementation defaults below. No website has been
implemented or deployed by this design checkpoint.

Build a public site whose homepage is a real Lensmap, followed by conventional,
readable documentation with source examples and live maps.

## Approved experience

### Homepage

- Begin in Lens view with an almost viewport-sized **Lensmap** thought bubble.
- Show smaller connected bubbles for the subtitle, **Get started**, **Examples**,
  **Documentation** and **GitHub**. Some smaller bubbles must be visible initially,
  not discoverable only after unexplained panning.
- Use actual shared lens projection, panning, zoom and keyboard navigation, not
  an independently animated collection of circles or a screenshot.
- Omit the playground editor and inspector. Remove nonessential application
  chrome through site-scoped presentation rather than changing other consumers.
- Use ordinary host CSS for the page and controls, and authored node styles for
  the thought bubbles. Keep the authored graph distinct from camera framing.
- Keep an ordinary Documentation link outside the interactive map. Supply
  meaningful static title, description and navigation without JavaScript.
- On narrow screens, the initial framing still exposes the name and an obvious
  route into the docs. The main bubble should be fully recognizable rather than
  depending on a cropped wordmark.

### Documentation

Use familiar Starlight pages with sidebar navigation, search, readable prose,
code blocks and examples. The initial subjects are:

- Quick start and installation.
- Writing thoughts, references, unresolved thoughts and connections.
- Navigation, keyboard controls and map/portal behavior.
- Custom connection types and project vocabularies.
- CSS node styling and measured sizing.
- Astro/Starlight integration and host boundaries.

Pair copyable source with live maps in the examples. Keep the explanation as an
ordinary article; do not turn documentation navigation into another graph.

## Architecture

### Site application

Create a private `apps/site` workspace using Astro, Starlight, React and the
existing Lensmap packages. Keep `apps/web` as the playground and leave the four
published package versions unchanged. Use the repository's already qualified
framework versions rather than independently choosing new ones.

A custom Astro homepage owns the hero, normal site navigation, metadata and
static fallback. Starlight owns conventional documentation routes and search.
The production output is static, with GitHub Pages project base `/lensmap/` and
no server, accounts, database or runtime source compiler.

### Actual renderer reuse

`apps/web/src/embed.ts` already exports the shared `Viewer`,
`layoutSemanticGraph`, graph types and `ViewerState`. The viewer accepts
`embedded`, `showInspector`, `initialState`, `initialTarget`, `onStateChange` and
`onActivatePortal`.

The public Starlight `ViewerHost` is tailored to its inspector mounts and does
not expose all of those controls. Therefore the site's custom hero may consume
the existing source-level entry, as the Starlight package itself does. Declare
the workspace dependency explicitly and make its source/build dependency
visible to Turbo. This is an internal monorepo consumer, not a newly promised
public export or a second renderer. Do not fork or copy the viewer algorithm.

Keep the hero source in a real `.lensmap` file and analyze it with the owning
document engine at build time. Invalid hero data fails the build with useful
engine diagnostics. No MDX execution is required for the hero or basic examples.

Documentation examples reuse the supported Astro/Starlight integration where
appropriate; custom inline demonstration components may consume the same shared
viewer when an ordinary prose page needs an embedded example.

### Navigation ownership

The hero's graph entries retain ordinary Lensmap destination meaning. Its host
callback owns activation: documentation/example routes navigate within this
site, while GitHub is an external destination. Preserve base-path handling,
keyboard activation and visible ordinary links. Do not change the product-wide
single-click-to-select / explicit-activation contract merely for marketing.
Use the existing destination callback and a compact selected-destination action
outside the graph so single click does not become a dead end without an inspector.

All ordinary navigation is rendered as native anchors in the static page.
Internal URLs, generated assets, examples and search must work beneath the
GitHub Pages base path, including direct visits and reloads of documentation.

## Reviewable implementation defaults

- Use `apps/site/src/pages/index.astro` for the homepage and
  `apps/site/src/content/docs/` for Starlight documentation.
- Start with a dark visual treatment, large confident typography, generous
  space and restrained branch accents. Avoid a dashboard frame around the hero.
- Initial subtitle: **Write thoughts. Explore connections.** This is site copy,
  not a schema field or a permanent brand commitment.
- Author a deliberate small hero arrangement using existing positions and
  numeric node sizing. Derive initial camera framing from the actual container
  and renderer geometry; do not introduce viewport units into the authoring
  schema or shrink text to disguise a too-small bubble.
- Wait for the first usable container measurement before initializing the hero.
  Once a visitor starts exploring, ordinary resizing must not reset selection
  or discard their camera state. No automatic motion or camera-tour animation.
- Keep the initial docs focused on the published 0.3.0 contract. Link deeper
  repository specifications rather than reproducing internal plans or logs.
- Prepare a GitHub Actions Pages workflow with least-required permissions and
  native Pages artifact/deployment actions. Look up current supported action
  revisions before writing it. No custom domain, analytics or tracking.

## Acceptance

- The built hero is sourced from the real analyzed map and shared viewer.
- Desktop and narrow first loads visibly show the giant name bubble, subtitle
  and a route to documentation. The hero is usable by pointer and keyboard.
- Site navigation works from the map and ordinary anchors; internal navigation
  stays in the site and GitHub opening is separate and safe.
- No-JavaScript visitors receive meaningful title, subtitle and working links.
- Conventional docs, examples, search and all assets resolve beneath `/lensmap/`.
  A direct documentation URL survives reload on the built static site.
- Live examples agree with their displayed source; unknown types and styling
  remain subject to the owning engine rather than a parallel parser.
- Shared viewer behavior and other hosts are unchanged. Any necessary shared
  change gets focused RED/GREEN evidence and dependent acceptance.
- Run native install/build/type/lint checks, focused site Playwright checks,
  desktop/narrow screenshot inspection and a bounded independent review before
  the local implementation checkpoint.

## Boundaries

This design checkpoint writes design and plan documents only. Site code,
workflow preparation and local verification follow implementation approval of
these written artifacts. Public push, Pages settings/enabling and deployment
are separate external actions; do not interpret design agreement as permission
to change account/repository settings or publish an unreviewed site.

No new npm release, Zed extension change, generic theming framework, renderer
rewrite, arbitrary map editor, analytics service or unrelated repository work.
