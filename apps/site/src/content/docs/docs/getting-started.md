---

title: Get started
description: Write your first map and open the viewer.
sidebar:
  order: 1
---

## Start with one thought

A Lensmap document is YAML containing Markdown-rich thoughts. Save this as
`first.lensmap`:

```yaml
version: v1
nodes:
  - Plan a small expedition
```

That is a complete map. No node IDs, coordinates or connection types are needed.
The format is experimental; `version: v1` identifies the current grammar.

## Let the thought branch

Promote the string into a richer thought when you want connections:

```yaml
version: v1
nodes:
  - full_text: Plan a small expedition
    connections:
      - Choose a route
      - Gather supplies
      - Ask who wants to come
```

Connections create the graph. Markdown links inside prose are navigation, not
extra drawn connections. You can keep writing before deciding how to arrange it.

## Open a map from your editor

Lensmap's first editor integration is Zed, using a language server and a browser
preview. Install the published runtime with a supported **Node 24.16 or newer**:

```sh
npm install --global @lensmap/language-server@0.3.0
lensmap-lsp --configure-zed
```

The second command prints settings; it does not edit Zed for you. The Zed
extension and a working binary configuration are also required. Follow the
[complete Zed setup](https://github.com/nicodoggie/lensmap/blob/main/docs/zed-browser.md)
for installation, the local override and opening the live preview. The separately
pinned extension does not automatically follow every npm runtime release.

For a website, use the [Astro/Starlight integrations](../integrations/).
For a source-checkout playground, see the
[repository run commands](https://github.com/nicodoggie/lensmap#run-locally).

Next: [write richer thoughts](../authoring/) or try a
[map with converging paths](../examples/).
