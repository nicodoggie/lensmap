# Parent-relative radial default layout

## Approved goal

Replace the current left-to-right automatic default with children ordered radially around their parent. Keep the position-free sample and its topology/Markdown unchanged; retain the archived positioned sample byte-for-byte. Do not retune the spatial lens or uniform zoom at the same time.

## Layout contract

- Use authored `branch` edges as a forest. Preserve child/source order around each parent. Cross-reference edges (including cycles/convergence) remain graph edges, not hierarchy or positioning forces.
- Give each root a full-circle child arrangement. Continue descendants in outward-facing local fans around their immediate parent so short branches do not simply point back through their ancestors. Multiple authored roots stay independent, with deterministic initial separation.
- Generate short local parent–child offsets, rather than converting one left-to-right global tree to polar coordinates. Keep explicit absolute coordinates exact; seed descendants from their parent's actual position.
- Use maintained `d3-force` collision relaxation around deterministic radial targets to reduce overlapping automatic circles, with authored coordinates and component roots fixed. The relaxation is initial layout only, not a perpetual physics animation. It is not a guarantee of collision-free projected lens output or a large-graph performance qualification.
- Keep `layoutGraph`'s owning TypeScript seam and the synchronous Apply pipeline unchanged. Return existing nodes/edges without changing IDs, source text or reference topology.

## Implementation and evidence

1. Add focused layout tests in `apps/web/src/document/layout.test.ts` through the actual parser/normalizer. Witness RED against the left-to-right implementation for radial sibling distribution and local outward child fans; cover stable YAML order, explicit coordinates and cross-link independence in the same bounded suite.
2. Replace only `document/layout.ts` using deterministic radial targets and native D3 collision forces. Inspect installed D3 runtime/types for random initialization and simulation termination semantics before using them. Keep package-level dependencies honest; retire Dagre when its last production consumer is removed.
3. Run the existing unit, lint, typecheck/build and real Chromium suites. Inspect default Lens and undistorted Overview captures; preserve separate acceptance limits for physical comfort and arbitrary graph density. Existing browser checks qualify actual sample parsing and all-node bounds.
4. Update README, schema/layout notes and verification record to describe the new default, while explicitly preserving optional authored positions and the archived comparison sample. No commits or publication.
