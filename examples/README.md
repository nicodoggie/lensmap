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
- [linked-maps.lensmap](linked-maps.lensmap) — a small notebook with portals to
  both samples, a direct jump to Night Ferry's tide window, web references and
  an ordinary file link. Includes a minimal address-only portal.

None of the samples requires authored positions. The existing positioned comparison
remains at `apps/web/examples/night-ferry-positioned.yaml`; the playground's
input remains at `apps/web/src/sample.yaml`.

## Try links between maps

1. Open `linked-maps.lensmap`, `quickstart.lensmap` and `night-ferry.lensmap` in
   Zed. The preview loads currently attached buffers, including unsaved edits;
   an unopened destination is reported as unavailable, not read from disk.
2. Open the linked notebook's preview. Click a portal to select it, then use
   **Open destination map** or double-click it. Whole-map links enter Overview;
   **Jump to the tide window** enters Lens centred on the authored `tides` ID.
3. Use the preview's **Back** action to return without losing your view. Web and
   ordinary file links use **Open external link** and the editor's opener.

Keep these files together: relative URLs resolve from the source map's location.
Pasting this sample into the standalone playground does not give it a source
location or local-file access. A hosted copy can use the standalone viewer's
`?map=` entry route when all destination files are served with normal browser
access; see [connection loading and host limits](../docs/default-connections.md#destination-loading-and-host-boundaries).

Try changing a title without saving, following the source caret, and using
**Reveal source** from Thought details. A temporary source error should retain
the last valid map with a visible stale status.
