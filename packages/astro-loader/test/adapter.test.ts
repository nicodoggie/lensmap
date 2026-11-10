import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { readProjectVocabulary } from "@lensmap/document/project";
import {
  canExecute,
  moduleStem,
  parseMap,
  writeGenerated,
} from "../src/adapter.ts";

test("executable content requires explicit canonical local admission", () => {
  const dir = mkdtempSync(join(tmpdir(), "lensmap-policy-"));
  const path = join(dir, "map.lensmap");
  writeFileSync(path, "nodes: []\n");
  const mdx = { mdx: { admittedSources: [realpathSync(path)] } };
  assert.equal(canExecute({ kind: "local", path }, mdx, true), true);
  assert.equal(canExecute({ kind: "local", path }, mdx, false), false);
  assert.equal(canExecute({ kind: "local", path }, {}, true), false);
  assert.equal(
    canExecute({ kind: "local", path: join(dir, "missing") }, mdx, true),
    false,
  );
  assert.equal(
    canExecute(
      { kind: "fetched", url: "http://localhost/map.lensmap" },
      mdx,
      true,
    ),
    false,
  );
  assert.equal(canExecute({ kind: "compiled" }, mdx, true), false);
});

test("native engine preserves authored source and open metadata", () => {
  const source =
    "version: v1\nfrontmatter:\n  title: ' Authored '\n  private: {a: 1}\nnodes:\n  - '# One'\n";
  const result = parseMap(source, "file:///map.lensmap");
  assert.deepEqual(result.authoredFrontmatter, {
    title: " Authored ",
    private: { a: 1 },
  });
  assert.equal(result.source, source);
  assert.equal(result.graph.nodes[0]?.markdown, "# One");
  assert.throws(
    () =>
      parseMap("version: v1\nunknown: true\nnodes: []", "file:///bad.lensmap"),
    /Invalid Lensmap/,
  );
});

test("generated identities distinguish same basenames; identical writes do nothing", () => {
  assert.notEqual(moduleStem("/a/map.lensmap"), moduleStem("/b/map.lensmap"));
  const dir = mkdtempSync(join(tmpdir(), "lensmap-generated-"));
  const path = join(dir, "module.astro");
  assert.equal(writeGenerated(path, "same"), true);
  assert.equal(writeGenerated(path, "same"), false);
  assert.equal(writeGenerated(path, "changed"), true);
});

test("map analysis consumes project vocabulary without changing source or authored metadata", async () => {
  const root = mkdtempSync(join(tmpdir(), "lensmap-astro-vocabulary-"));
  try {
    writeFileSync(
      join(root, "lensmap.config.json"),
      '{"types":"shared.lenstypes"}',
    );
    writeFileSync(
      join(root, "shared.lenstypes"),
      "connection_types:\n  reference:\n    extends: external_link\n    line-style: dotted\n    text: cites\n    reverse_text: is cited by\n",
    );
    const vocabulary = await readProjectVocabulary(root);
    const source =
      "version: v1\nfrontmatter: {title: ' Authored '}\nnodes:\n  - full_text: Parent\n    connections:\n      - type: reference\n        url: https://example.org/guide\n";
    const uri = pathToFileURL(join(root, "map.lensmap")).href;
    const result = parseMap(source, uri, vocabulary.input);
    assert.equal(result.source, source);
    assert.deepEqual(result.authoredFrontmatter, { title: " Authored " });
    assert.equal(result.graph.nodes[1].destination?.kind, "external_link");
    assert.equal(result.graph.edges[0].presentation?.lineStyle, "dotted");
    writeFileSync(
      join(root, "lensmap.config.json"),
      '{"types":"missing.lenstypes"}',
    );
    const failed = await readProjectVocabulary(root);
    assert.throws(() => parseMap(source, uri, failed.input), /Invalid Lensmap/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
