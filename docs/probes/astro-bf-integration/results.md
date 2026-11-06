# BF / Astro PoC result

## Working local environment

- Dev page: <http://127.0.0.1:4329/world/notes/the-vengeful/threads/elven-boons/>.
- BF worktree: `/home/ensu/.t3/worktrees/bastion-falls-astro/lensmap-integration`, branch `lensmap-integration`, unchanged base HEAD `75725a65c8b120302049c4e91cf1ba3e09cd6994`.
- Start/reproduce from `spikes/lensmap-integration` in that worktree, not from the ordinary full-site BF command. The normal BF docs loader remains unchanged.
- The BF thread left one loopback dev server running (`npm run dev`, listener PID `2043492`, terminal handle `proc_30a33dcb376e` at final readback). Parent independently read the process command and exercised its page through the shared T3 preview.
- Full report: `/home/ensu/.t3/worktrees/bastion-falls-astro/lensmap-integration/spikes/lensmap-integration/README.md`.

The BF thread is <t3-thread://v2/83112fd3-0947-4d13-a1db-a76bf59117a7/mcp:launch:8a27d89df6ab2dc0b68e84d9b4a3c59b61112563a5e0cdbf2f0524178224fff1>. Its report and native evidence were inspected; the claims below are limited to this local PoC.

## Real-data conversion

The exact authorized `astro/src/content/docs/world/notes/the-vengeful/threads/elven-boons.mdx` was replaced only in the BF worktree with the adjacent `.lensmap` file. The preserved original is `spikes/lensmap-integration/fixtures/elven-boons.original.mdx`.

Parent independently verified:

- The primary BF MDX still exists and is byte-identical to the preserved fixture, SHA-256 `29f789015b5a170fbea7779a522ca6989d95d93622e4374e8011df090b1e8121`.
- Map frontmatter preserves the original title and `threads` tag.
- Preorder concatenation of every thought's `full_text` exactly reproduces the original Markmap Markdown, including authored links and tentative questions.
- The real document engine validates the metadata-separated graph as 12 thoughts and 11 untyped branch edges. Only existing heading hierarchy became topology; Markdown bullets remained intact as prose.

## Implementation placement

Lensmap owns the local viewer entry, embedded markup, same-session external inspector callback and scoped styling; see [viewer-seam.md](viewer-seam.md). BF owns the probe's Astro registration/rendering bridge, collection schema and routing, sidebar shell/host, synthetic trust fixtures, conversion, and dev environment. No lens/layout algorithms were copied.

The actual viewer is hydrated in a native Starlight docs route. Its inspector is portaled into BF's responsive sidebar targets. Parent exercised native pointer map selection and native inspector connection navigation in the shared preview, confirming the selected graph node, matching prepared thought text, unchanged containing page title, no nested `main`, and no horizontal page overflow. Final pointer travel from Gems to Emerald retained the same browser document identity.

Desktop and narrow screenshots were inspected. Mobile access works but the inspector currently precedes the map and consumes significant vertical space; this is not a final mobile interaction design.

## Evidence and qualification

### Lensmap

- Focused embedding regression observed RED, then GREEN.
- Web unit suite: 75 passing tests.
- `pnpm check`: passed, with seven unchanged informational lint suggestions in language-server tests; unchanged document/server tasks used native Turbo cache results.
- Final web TypeScript check and production build: passed.
- Built Playwright suite: 37 passing tests after final CSS scope refinement.
- Independent source review identified a CSS specificity/import-order risk for bridge overrides. The built bridge did not reproduce the predicted hidden-masthead regression; its extracted CSS loads the bridge overrides later. The scope nevertheless now uses `:where(.lensmap-viewer)` to retain the original selector specificity, and the existing bridge acceptance test explicitly checks its masthead remains hidden. No false RED or production regression claim is made for that refinement.
- `git diff --check`: passed.

### BF probe

Native receipts in the BF report cover policy tests (2 passing), conversion, a static production build (7 pages), and scoped TypeScript; parent parsed all four recorded command exits as zero. Eight grouped local-browser acceptance checks passed with zero page errors, including native docs coexistence, metadata, trusted versus inert content, responsive panels and actual Pagefind search. These are grouped script checks, not eight independently named Playwright tests.

The final stability proof runs a production build and four route requests while retaining selection: generated-file mtimes and browser document identity remain unchanged, the selected thought and page title survive, and no page errors occur. Fixes avoid identical generated-module writes and exclude changing evidence artifacts from Tailwind's content scan.

BF probe lint exits zero but reports 23 warnings and one informational finding; it is not warning-free. Earlier setup/build/browser failures remain recorded in the BF evidence rather than being recast as baseline product failures.

## Limits and next boundary

Overall result: **PARTIAL — working local integration PoC, not a supported production adapter.**

- Compilation registration uses private Astro `addContentEntryType` / `getRenderModule` hooks.
- Core frontmatter is not implemented; the adapter removes metadata before the strict engine parse, so its source positions do not correspond to the original authored YAML.
- The viewer is consumed through a local source entry, not a published package.
- Elven Boons uses the sanitized non-executable Markdown path. Trusted MDX is proven with synthetic admitted fixtures; arbitrary remote-map fetching/execution is not implemented.
- General relative imports in generated MDX and client-component/island lifecycle are not fully qualified.
- The fixture intentionally omits external Fantasy Calendar execution and full lexicon manifests; neighboring BF articles are not a full-site acceptance target.
- Disabling TOC still gates the whole BF right rail. No fake headings were added to hide that limitation.

No BF commits, pushes, deployments, public source endpoints, account changes or broader site migration occurred. The primary BF checkout was not edited. The Lensmap viewer change is eligible for a local reviewed milestone checkpoint under its repository policy; remote publication remains unauthorized.
