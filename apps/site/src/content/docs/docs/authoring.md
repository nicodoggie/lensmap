---

title: Write thoughts and connections
description: Start small; add detail, convergence and cycles when useful.
sidebar:
  order: 2
---

## Strings are thoughts

```yaml
version: v1
nodes:
  - |
    A thought with a little more to say

    This paragraph is **Markdown**, not a label field.
```

The first line supplies the collapsed label. The remaining Markdown is expanded
content. Multiple entries in `nodes` are multiple starting thoughts, not a
mandatory document-title node.

## Add a summary only when you need one

```yaml
version: v1
nodes:
  - summary: A short label
    full_text: |
      # The longer thought

      Preserve the full explanation here.
```

`summary` overrides the collapsed label. Summary-only nodes work too. You do not
need to duplicate text across both fields.

## Converge on an existing thought

```yaml
version: v1
nodes:
  - full_text: Two ways forward
    connections:
      - full_text: Follow the river
        connections:
          - id: bridge
            full_text: Reach the bridge
      - full_text: Take the ridge
        connections:
          - node_id: bridge
```

Use an optional `id` only when you need an addressable thought. A `node_id`
reference reuses the target rather than creating a second copy. References can
converge or make cycles. A reference cannot replace the target's content or style.

## Leave a thought unresolved

A bare nested array represents an unresolved intermediate thought, not a group
that gets flattened away:

```yaml
version: v1
nodes:
  - full_text: We need another way across
    connections:
      - [Ask the ferryman, Look for a ford]
```

This means “another way across → unresolved thought → the two possibilities.”
An explicit empty `summary` or `full_text` can also hold that place and its
connections. Omitting both fields is different from explicitly empty content.

## Positioning is optional

A rich thought can supply `position: { x: 120, y: 80 }`. Authored positions remain
world-layout constraints, separate from the lens and camera. Without positions,
the viewer computes the layout for you.

See the [authoring reference](https://github.com/nicodoggie/lensmap/blob/main/docs/schema-v1.md)
for exact fields and validation boundaries.
