import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateJSONSchema, generateVocabularyJSONSchema } from "./index.js";

const target = process.argv[2];
if (!target) throw new Error("Supply the generated schema's output filename.");
const path = resolve(target);
await mkdir(dirname(path), { recursive: true });
await writeFile(
  path,
  `${JSON.stringify({ ...generateJSONSchema(), title: "Lensmap experimental v1", $comment: "Generated from the owning Zod input schema. Not a public compatibility promise; document-wide IDs/references are checked by the engine." }, null, 2)}\n`,
);
if (process.argv[3]) {
  const vocabulary = resolve(process.argv[3]);
  await mkdir(dirname(vocabulary), { recursive: true });
  await writeFile(
    vocabulary,
    `${JSON.stringify({ ...generateVocabularyJSONSchema(), title: "Lensmap experimental connection vocabulary", $comment: "Generated from the owning Zod input schema. Layered inheritance and CSS value semantics are checked by the engine." }, null, 2)}\n`,
  );
}
