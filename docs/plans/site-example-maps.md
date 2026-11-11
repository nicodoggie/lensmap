# Site example-map navigation implementation plan

## Approved goal and scope

Nico approved turning the homepage Examples thought into a map portal: enter a
separate examples-index map, follow portals to separate example maps or a specific
thought, and return through retained map history. Conventional source/example docs
remain available. Initial map files are hosted with this static site.

Work in `/home/ensu/Projects/lensmap`, `feat/github-pages-site`, starting from
`e8e1843ec614dbc9b5d02cadb34960b63e8a266a`. No push, Pages mutation, package
publication, dependency change or sibling writes. Preserve the existing grouped
homepage composition and user-owned preview process on port 4333.

## Architecture

Use the existing `Navigation` controller, `useMapNavigation`, source parser and
shared Viewer. Keep source acquisition, browser URL/history integration and
site-local ordinary navigation in the site host; do not copy the playground or
introduce a second navigation state machine.

Publish raw authored documents through a native static Astro endpoint. The hero
has the source URL `hero.lensmap` at the project base so its existing relative docs
links keep their authored meaning. The examples index and sample family live
beneath `examples/`. Reuse repository quickstart, Night Ferry and node-styling
source; reuse the self-contained docs example for custom connection types (the
project-backed vocabulary example needs a shared file and is not standalone).
Validate every published map with DocumentSession during the native build.

Whole-map travel starts in Overview; a fragment enters centred Lens view. Retain
camera, selection and temporary-view state on Back/Forward, including return to
the initial hero. Maintain browser visit identity independently of mutable stack
indices. Support query/fragment bootstrap and copyable map/thought links. Failed
fetch/parse/target selection retains the current map; reuse missing-target fallback.
Fetched Markdown stays inert; HTTP(S) acquisition obeys CORS and uses no
credentials.

Only the homepage receives marketing chrome overrides. Example maps expose normal
viewer controls and thought inspection, without the playground editor. Map Back
and Forward are ordinary accessible host controls outside hidden hero toolbars.
The static no-JavaScript Examples link leads to conventional documentation.

## Implementation and qualification

1. Add one focused production-browser round-trip regression before implementation:
   hero → index → sample; exact view restoration through explicit Back/Forward,
   targeted tide portal, direct URL/reload and fetch-failure retention.
   Witness RED.
2. Create `apps/site/src/maps/examples.lensmap`, `src/example-maps.ts` and
   `src/pages/[...map].lensmap.ts`; change the hero Examples destination to
   map_link. Use native Astro static generation, not a custom filesystem endpoint
   or copier. Declare reused root sample files as
   native site Turbo build inputs and include example changes in the prepared
   Pages workflow path filter; changes must not reuse stale generated source.
3. Keep measured home initialization in HeroMap; add a site MapSession using the
   existing controller and retained entries. Resolve map-relative destinations
   from the actual source URL, retain redirects/cache aliases, gate URL writes on
   committed navigation, and clean up session listeners on unmount.
4. Scope hero CSS to the home state, style host map travel controls, keep normal
   sample reading available, and preserve the no-JavaScript docs route. Update the
   existing documentation/example page and site runbook with actual URLs.
5. Run focused GREEN and existing site unit/type/build/browser gates. Inspect
   desktop and narrow example/index captures plus return-to-hero framing. Use the
   existing preview read-only via a temporary Playwright configuration, never
   replace or stop its process. Report actual subset scope if needed.
6. Obtain one bounded combined independent spec/quality review of the frozen
   candidate, resolve concrete findings and make a verified local checkpoint.

Focused TDD applies to new host navigation behavior. Native Astro build and engine
analysis qualify static publication; no substring tests, manifest census, duplicate
schema, per-function suites or release requalification. Shared viewer/controller
changes are not expected; if required, run their owning focused regressions too.

## Acceptance

All index/sample URLs serve actual YAML beneath `/lensmap/`; portal selection does
not navigate until explicit activation. Whole/targeted entry and map return behave
as above, browser visits do not alias after a map-stack branch, direct links work
on static reload, failures preserve the current graph/view, and conventional docs
remain usable. No credentials, runtime MDX, npm release or public deployment.
