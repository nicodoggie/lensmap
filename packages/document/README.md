# @lensmap/document

Experimental, host-independent Lensmap document engine. Provides YAML analysis,
semantic graphs, revision-bound source bindings, session identities and bounded
source-preserving content edits. Does not own layout, browser rendering or LSP.

Requires Node 24.16 or newer. ESM only. The API and `version: v1` authoring format
are incomplete and experimental; `0.x` is not a promise of a stable schema.

```sh
npm install @lensmap/document
```

```js
import { DocumentSession } from "@lensmap/document";

const session = new DocumentSession(
  "file:///notes.lensmap",
  "version: v1\nnodes: [First thought]\n",
  1,
);
console.log(session.snapshot());
```

The root export includes `DocumentSchema`, `generateJSONSchema` and the session
API. `@lensmap/document/v1` exposes the experimental structural schema. Both
exports include TypeScript declarations. Thought/edge keys are attachment-local
internal identities, not authored persistent IDs. Source/LSP positions use
zero-based UTF-16 units.

See the [source and format documentation](https://github.com/nicodoggie/lensmap)
for supported syntax and limitations. MIT licensed; see `LICENSE`.
