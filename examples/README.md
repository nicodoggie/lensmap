# Lensmap samples

Open these ordinary UTF-8 YAML files directly in Zed after following the
[editor setup](../docs/zed-browser.md), then use **Lensmap: Open preview** from
code actions. The `version: v1` format remains incomplete and experimental.

- [quickstart.lensmap](quickstart.lensmap) — a small, commented version of the
  [schema guide's example](../docs/schema-v1.md): Markdown, shorthand children,
  unresolved thoughts, a shared target and a cycle. Start here to try editing.
- [night-ferry.lensmap](night-ferry.lensmap) — the larger Night Ferry map from
  the web playground, with automatic layout, converging connections and longer
  notes. The ferry setting is invented, not Bastion Falls canon. This is an
  editable standalone copy, not a second source for the playground's default.

Neither sample requires authored positions. The existing positioned comparison
remains at `apps/web/examples/night-ferry-positioned.yaml`; the playground's
input remains at `apps/web/src/sample.yaml`.

Try changing a title without saving, following the source caret, and using
**Reveal source** from Thought details. A temporary source error should retain
the last valid map with a visible stale status.
