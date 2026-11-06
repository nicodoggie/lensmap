# Manual npm latest promotion implementation plan

## Approved design and scope

Nico approved automatic `npm-v…` releases publishing to `next`, with a manual
**Update latest** checkbox (off by default) and an exact already-published
version. Unchecked manual runs retain verification-only behavior. Checked runs
promote both packages without rebuilding or publishing either package, leave
`next` unchanged and use the existing `npm` environment. Local implementation,
verification and a milestone commit are in scope; no push, registry mutation or
account/environment change is authorized by this implementation request.

## Architecture

Keep event routing in `.github/workflows/npm-release.yml`. A small dependency-free
TypeScript command owns exact-version validation, preflight of both public
packages, native npm dist-tag invocation and readback. Preflight both packages
before the first write. Preserve and report partial completion if a later write
fails; npm tags are not transactional and there is no automatic rollback.
Use an npm version with verified OIDC dist-tag support, not the older
publish-only client. Use Node's existing native TypeScript/test support and
include the focused tests in `pnpm check`; do not add a workspace or dependency.

## Implementation tasks

1. Create `scripts/npm-promote.test.ts` with focused tests for exact-version
   validation, both-package preflight, matching server dependency, latest-only
   writes/readback, dry run, second-write failure and unchanged-next enforcement.
   Run with `node --test` against the missing implementation (RED).
2. Implement `scripts/npm-promote.ts`, using argument arrays (never shell
   interpolation), explicit public registry and sanitized npm failure diagnostics.
   Retry readback only, never mutation, for bounded registry propagation. Run the
   same tests (GREEN). Add `test:release` and integrate with `pnpm check`;
   permit TypeScript-extension imports in the no-emit scripts compiler config.
3. Add manual boolean/version inputs and a dedicated OIDC-capable promotion job.
   Skip builds/packing for checked promotions; retain automatic `next` publishing
   and unchecked verification. Keep the npm environment, least-privilege job
   permissions and existing workflow-wide serialization. Validate with actionlint.
4. Update `docs/npm-release.md` with current publication evidence, manual controls,
   dist-tag permission, environment branch/tag policy and partial-promotion
   recovery. Do not claim reported npm trust configuration has been validated.
5. Run focused tests, actual public-registry dry run for `0.1.0`, `pnpm check`,
   actionlint and diff review. Confirm registry tags are unchanged. Make one
   scoped local milestone commit; report hosted execution as unexercised.
