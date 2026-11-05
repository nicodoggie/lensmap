# Lensmap project instructions

- Read `HANDOFF.md` before product/schema decisions; `docs/design.md` describes the current implementation slice, not a replacement grammar.
- Work only in this repository. Confirm `git rev-parse --show-toplevel` is this directory; preserve all sibling projects.
- Make local commits at meaningful, verified milestones rather than every leaf edit. Nico explicitly authorized this standing checkpoint policy, superseding the initial handoff's no-commit hold. Review and stage only the owned source/tests/docs; keep installed dependency trees, build/cache output and secrets out. Commit dependency manifests and the lockfile with their source changes. Pushes, remote creation and publication still require explicit user authorization.
- TypeScript, pnpm, Turborepo. Development order: web app, embeddable viewer, language server. Do not create placeholder packages merely for future phases.
- Before modifying Turbo tasks/config, read installed `node_modules/turbo/docs/README.md` and the relevant bundled pages.
- Use focused RED/GREEN tests for maintained behavior. Prefer native tooling for manifests/config. Verify rendered UI with local Playwright; shared T3 preview only when the current request asks for browser work.
- Keep authored layout separate from camera/lens deformation. Spatial focus is not graph-distance sizing. Prose links navigate; explicit connections alone define topology.
- Preserve Markdown source. Do not turn provisional YAML exploration into an approved public schema or conflate renderer-internal keys with required authored IDs.
- `pnpm check` runs unit tests, typechecks, lint and build. `pnpm test:e2e` exercises the built web app; install its browser with `pnpm exec playwright install chromium` if needed.
