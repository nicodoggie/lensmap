# Hero spatial-focus implementation plan

**Goal:** Make the homepage demonstrate Lensmap's navigational value through obvious spatial growth and recession as visitors move focus.

**Approved design:** Stronger watchOS-like focus change, not merely a larger initial wordmark. Keep navigation readable and recognizable initially on desktop and narrow screens. Preserve deliberate user movement, authored topology and source/view separation. Do not change the shared projection algorithm, other maps, or add automatic camera motion.

**Architecture:** Tune `apps/site/src/hero.ts` and the authored presentation in `apps/site/src/maps/hero.lensmap`. Use the existing viewer projection and clearance; reduce fixed wordmark/satellite size disparity if it masks focus. Keep initial camera framing separate from lens strength.

**Tech stack:** Existing TypeScript, React/Astro, Vitest and local Playwright. No dependencies or Turbo task changes.

## Task 1: Establish focus contrast

- Inspect the actual hero projection and authored sizes at desktop and narrow viewports.
- Extend `apps/site/src/hero.test.ts` with one maintained behavioral case: moving the camera from wordmark to a navigation bubble substantially enlarges that bubble, shrinks the wordmark, and makes the focused navigation bubble visually prominent.
- Use the actual `projectPoint` and `limitMagnification` functions, not a second lens implementation. Keep assertions about visible behavior rather than a fixed strength constant.
- Run `pnpm --filter @lensmap/site test` and retain the focused baseline failure before production edits.

## Task 2: Tune the site-only presentation

- Adjust `apps/site/src/hero.ts` strength/framing and the existing hero map's numeric scales, type sizes and pins only as needed.
- Preserve the existing legibility, source immutability and initial in-bounds checks. Do not weaken those checks to hide clipping or collisions.
- Inspect actual desktop/narrow rendered screenshots using local Playwright. Exercise focus transfer as well as the initial composition; a static screenshot cannot prove navigation.

## Task 3: Verify and checkpoint

- Extend an existing site browser case to measure navigation-bubble growth and wordmark recession after camera movement, while keeping the link usable.
- Run focused site Vitest, native site/dependency typecheck/build, relevant Biome and the complete eight-case site browser suite.
- Update the site runbook/design with the accepted focus behavior, then review the owned diff and make one meaningful local implementation commit. Keep the earlier HTTP-only policy commit separate.
- Do not push or deploy this new visual change without publication authority. The already-authorized certificate follow-up remains a separate task; preserve its accepted DNS and deployment state.

## Acceptance boundary

The result must visibly promote a navigation thought as it reaches spatial focus and demote the old centre, without making the homepage's initial links illegible or changing global graph semantics. Synthetic browser evidence is not a claim about physical touch comfort or large-graph behavior.
