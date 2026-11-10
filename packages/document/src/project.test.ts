import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { readProjectVocabulary } from "./project.js";

const scratch = tmpdir();
const roots: string[] = [];
async function project(prefix: string) {
  const root = await mkdtemp(join(scratch, prefix));
  roots.push(root);
  return root;
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
it("loads only explicit root config and bounded vocabulary, with live buffers first", async () => {
  await mkdir(scratch, { recursive: true });
  const root = await project("lensmap-project-");
  expect((await readProjectVocabulary(root)).input.error).toBeUndefined();
  await writeFile(
    join(root, "lensmap.config.json"),
    '{"types":"a.lenstypes","types":"b.lenstypes"}',
  );
  expect((await readProjectVocabulary(root)).input.error).toBeTruthy();
  await writeFile(join(root, "lensmap.config.json"), '{"types":"a.lenstypes"}');
  expect((await readProjectVocabulary(root)).input.error).toBeTruthy();
  const buffers = new Map([
    [join(root, "a.lenstypes"), "connection_types: {live: {}}"],
  ]);
  expect(
    (await readProjectVocabulary(root, buffers)).input.declarations,
  ).toHaveProperty("live");
  await symlink(scratch, join(root, "escape"));
  buffers.set(
    join(root, "lensmap.config.json"),
    '{"types":"escape/out.lenstypes"}',
  );
  const denied = await readProjectVocabulary(root, buffers);
  expect(denied.input.error).toBeTruthy();
  expect(denied.files).toEqual([join(root, "lensmap.config.json")]);
});
it.each([
  "null",
  "[]",
  '{"types":""}',
  '{"types":"a.lenstypes","extra":1}',
  '{"types":"a.lenstypes",}',
  '{"types":false}',
])("rejects invalid strict config %s", async (config) => {
  await mkdir(scratch, { recursive: true });
  const root = await project("lensmap-config-");
  const result = await readProjectVocabulary(
    root,
    new Map([[join(root, "lensmap.config.json"), config]]),
  );
  expect(result.input.error).toBeTruthy();
});
it("resolves config-relative files and reports exact missing watch targets", async () => {
  await mkdir(scratch, { recursive: true });
  const root = await project("lensmap-targets-");
  await mkdir(join(root, "vocab"));
  await writeFile(
    join(root, "lensmap.config.json"),
    '{"types":"vocab/types.lenstypes"}',
  );
  const missing = await readProjectVocabulary(root);
  expect(missing.files).toEqual([
    join(root, "lensmap.config.json"),
    join(root, "vocab/types.lenstypes"),
  ]);
  expect(missing.input.error).toBeTruthy();
  await writeFile(
    join(root, "vocab/types.lenstypes"),
    "connection_types: {saved: {}}",
  );
  expect((await readProjectVocabulary(root)).input.declarations).toHaveProperty(
    "saved",
  );
  await writeFile(
    join(root, "vocab/types.lenstypes"),
    "connection_types: {broken: {text: forward}}",
  );
  expect((await readProjectVocabulary(root)).input.error).toBeTruthy();
});
