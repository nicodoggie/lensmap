import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateJSONSchema } from "./index.js";

const target = process.argv[2];
if (!target) throw new Error("Supply the generated schema's output filename.");
const path = resolve(target);
await mkdir(dirname(path), { recursive: true });
await writeFile(
  path,
  `${JSON.stringify({ ...generateJSONSchema(), title: "Lensmap experimental v1", $comment: "Generated from the owning Zod input schema. Not a public compatibility promise; document-wide IDs/references are checked by the engine." }, null, 2)}\n`,
);
