# Shared custom connection types

This source-checkout example combines a project vocabulary with a small
map-local colour override. It does not change the meaning of thoughts or grant
new access to external resources.

- `lensmap.config.json` selects one shared YAML vocabulary.
- `relationships.lenstypes` derives `requires` from `precedes` and `reference`
  from `external_link`.
- `map.lensmap` changes only the colour of `requires`. Its width, arrow and
  wording still come from the effective parent and shared declaration.

## Try it in the editor bridge

Build the checkout and follow [Zed setup](../../docs/zed-browser.md), using the
local runtime override. Open **this directory as the workspace root**, then
open `map.lensmap` and its Lensmap preview. Root discovery is explicit: opening
the enclosing repository does not discover nested project configurations.

Change `stroke-width` in `relationships.lenstypes` and save. The preview should
update without editing the map. Invalid declarations retain the last valid
presentation with a stale warning. Attached live vocabulary buffers take
precedence over disk; an editor must actually forward the buffer to the server.

The standalone browser does not discover a sibling file on your disk. To use
this example there, combine the shared and local declarations inline first;
do not expect the browser to read `lensmap.config.json` automatically.

## Analyze it from the checkout

From the repository root, build the engine and run this native Node example:

```sh
pnpm --filter @lensmap/document build
node --input-type=module -e '
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DocumentSession } from "./packages/document/dist/index.js";
import { readProjectVocabulary } from "./packages/document/dist/project.js";
const root = new URL("./examples/custom-connection-types/", import.meta.url);
const map = new URL("map.lensmap", root);
const { input } = await readProjectVocabulary(fileURLToPath(root));
const snapshot = new DocumentSession(map.href, await readFile(map, "utf8"), 1, input).snapshot();
if (!snapshot.valid) throw new Error(JSON.stringify(snapshot.diagnostics));
console.log(JSON.stringify(snapshot.graph.edges.map(({ type, presentation }) => ({ type, presentation })), null, 2));
'
```

The `requires` connector has a `3px` width, the local gold colour and an arrow.
The `reference` connector is dotted with a circular end marker; its destination
remains an ordinary external-link thought. This command proves analysis, not
browser painting or permission to open that URL.

See the [declaration contract](../../docs/custom-connection-types.md) for the
complete fields, layering rules and host boundaries. These changes are in the
source checkout; this example does not assert a new npm release.
