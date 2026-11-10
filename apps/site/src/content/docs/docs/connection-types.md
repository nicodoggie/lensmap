---

title: Custom connection types
description: Give relationships your own names, appearance and wording.
sidebar:
  order: 4
---

Untyped connections are complete connections. Add a type when its wording or
appearance helps; Lensmap does not interpret your relationship as executable
causality, a prerequisite or a simulation rule.

## Declare a relationship inline

```yaml
version: v1
connection_types:
  reveals:
    extends: precedes
    text: reveals
    reverse_text: is revealed by
    line-color: "#d4ae68"
    stroke-width: 3
nodes:
  - full_text: Search the archive
    connections:
      - type: reveals
        full_text: A forgotten footpath
```

A relationship belongs to the connection, not globally to its destination.
The built-in vocabulary includes `precedes`, `follows`, `prevents`, `optional`,
`external_link` and `map_link`. An unknown name is an error, not a silent fallback.

## Presentation and inheritance

Declarations can specify `line-style` (`solid`, `dashed`, `dotted`), `line-color`,
`stroke-width`, endpoint markers and paired `text` / `reverse_text` wording.
New types can inherit from custom or built-in parents. Existing names can be
restyled without extending themselves. Cycles and unknown parents are errors.

The effective layers are **built-ins → shared vocabulary → document-local**.
A later layer replaces only fields it supplies. Portal capability belongs to the
underlying core type; changing connector appearance cannot grant a new opener.

## Share a vocabulary in an editor project

At the known project root, `lensmap.config.json` selects one file:

```json
{ "types": "relationships.lenstypes" }
```

The `.lenstypes` file contains the same `connection_types` mapping, without a
`nodes` section or document `version`. Relative paths are based on the config
file. Project-aware hosts reload changes and retain a visibly stale last-valid
map on invalid vocabulary. Live buffers take precedence only when the host
actually forwards them.

A standalone browser does not gain access to sibling files on your disk.
See the [complete declaration contract](https://github.com/nicodoggie/lensmap/blob/main/docs/custom-connection-types.md)
for marker values, inheritance details, source diagnostics and resource limits.
