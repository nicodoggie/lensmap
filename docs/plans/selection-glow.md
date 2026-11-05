# Selected immediate-connection glow

## Approved behaviour

Give the selected node, all one-hop neighbours and directly incident connectors a soft branch-coloured glow. Include incoming/outgoing branch edges, cross-links and self-loops; do not traverse through neighbours or infer topology from prose. Keep unrelated context visible, existing colours/dashes/arrowheads and keyboard focus rings intact. This is presentation only: do not change layout, projection, clearance, source or selection semantics.

## Implementation

- In `App.tsx`, derive incident edges from the active renderer key, then a deduplicated set of their endpoints. Paint incident SVG edges last so unrelated edge halos cannot cover the highlighted route. Add connected classes and a safe branch-colour CSS variable without making neighbours selected.
- In `styles.css`, use static outline box-shadows for connected/selected circles and coloured drop-shadow on incident strokes. Make the selected circle slightly brighter rather than adding an extra solid ring. Add a modest border/stroke emphasis as a non-colour cue. Preserve cross-link dashes/arrowheads, keyboard focus outlines, pointer behaviour, fixed body dimensions and shared uniform scene zoom. No pulsing or motion.

## Evidence and checkpoint

Add one actual Playwright regression through YAML Apply: selected root, outgoing branch, incoming cross-link, outgoing cross-link, self-loop, transitive child, neighbour-to-neighbour edge and prose-only target. Verify exact one-hop classes, computed glow, retained dash/marker cues, highlight updates after keyboard selection and Overview retention; save representative captures. Witness RED, implement GREEN, then run native format/check and the existing browser suite. Pure unit duplication of this small renderer-only predicate is unnecessary.

Inspect rendered captures, perform a bounded read-only pre-commit review, stage only this feature's owned source/tests/docs and make one meaningful local milestone commit under the standing policy. No remote creation, push or publication.
