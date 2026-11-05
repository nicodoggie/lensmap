# Subtree-contour radial packing implementation plan

## Approved goal and frozen controls

Improve initial subtree expansion relative to sibling branches. Keep `lens.ts`, `clearance.ts`, the default YAML and the positioned comparison sample unchanged. Retain parent-relative radial layout, clockwise source order, exact authored coordinates, reference-edge independence, stable navigation and compact local links. No commits/publication.

## Approach and reuse boundary

Use maintained D3 polygon hulls for compact outer contours of actual node centres, expanded analytically by the existing layout clearance radius. Do not substitute one large bounding circle or a descendant count. Generic tidy Cartesian-to-polar layouts do not own this parent-relative contour/pin policy; retain the existing D3 initial collision solver for fine adjustment and constrained/multiple-root cases.

Build each automatic subtree bottom-up in a local forward frame. Calculate the angular silhouette of each child's padded contour as seen from its parent. Pack these occupied intervals in source order, rotating whole automatic branches. A non-root fan may widen into its forward half-plane before any local edge distance grows; if required intervals still do not fit, find the smallest sufficient local distance to visual precision. Root children use the full circle. A long thin chain should not consume the angular room of an equally populous broad fork.

Seed the real layout from these plans. Rebase automatic descendants at actual authored pin coordinates and keep pins exact. A manually constrained branch can deviate from its ideal contour; preserve the existing collision/clearance fallback rather than promise conflict-free arbitrary pins. Keep existing component-root placement for this bounded experiment.

## Tasks and acceptance

1. Record a native Vite-loaded parser/projection baseline (same graph and representative viewport/foci), immutable-control file digests and existing test captures in scratch. Keep comparison evidence separate from permanent source invariants.
2. Add two owning layout regressions: angular allocation reflects broad-vs-deep footprint rather than count; neighbouring broad subtree angular contours do not interleave. Run RED against the existing layout. Retain existing radial, compact-link, explicit-pin and cyclic-reference tests.
3. Implement the contour planner in `apps/web/src/document/subtree.ts` using `d3-polygon`, wire it into `document/layout.ts`, and run focused GREEN. No live force simulation or camera-driven re-layout.
4. Run `pnpm check` and `pnpm test:e2e`; inspect undistorted Overview first and A-step-free-pier maximum-zoom Lens afterward. Re-run the native baseline probe to assess clearance burden and unchanged controls; do not hide a regression behind passing structural tests.
5. Record real evidence and limits in project docs, update the current layout description and retire obsolete fixed-fan wording. Native format/lock checks for declarative changes; no configuration snapshot suite or permanent checksum guard for editable source.
