import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const root = resolve(import.meta.dirname, "..");
const artifacts = join(root, "artifacts/npm");
const { values } = parseArgs({ options: { test: { type: "boolean" } } });
function run(command: string, args: string[], cwd = root, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} ${args[0]} failed (${result.status}).`);
}

run("pnpm", ["build"]);
await mkdir(artifacts, { recursive: true });
const tarballs: string[] = [];
for (const name of ["document", "language-server"]) {
  const directory = join(root, "packages", name);
  const manifest = JSON.parse(
    await readFile(join(directory, "package.json"), "utf8"),
  );
  run("pnpm", ["pack", "--pack-destination", artifacts], directory);
  tarballs.push(join(artifacts, `lensmap-${name}-${manifest.version}.tgz`));
}

if (values.test) {
  const consumer = await mkdtemp(join(tmpdir(), "lensmap-npm-"));
  try {
    await writeFile(
      join(consumer, "package.json"),
      JSON.stringify({
        name: "lensmap-package-consumer",
        private: true,
        type: "module",
      }),
    );
    run(
      "npm",
      [
        "install",
        "--omit=dev",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        ...tarballs,
      ],
      consumer,
    );
    const probe = join(consumer, "probe.ts");
    await writeFile(
      probe,
      `import assert from 'node:assert/strict';
import { DocumentSession, DocumentSchema } from '@lensmap/document';
import { DocumentSchema as v1 } from '@lensmap/document/v1';
import { startServer } from '@lensmap/language-server';
assert.equal(DocumentSchema, v1);
assert.equal(typeof startServer, 'function');
const snapshot = new DocumentSession('file:///consumer.lensmap', 'version: v1\\nnodes: [Installed]\\n', 1).snapshot();
assert.ok(snapshot.graph);
assert.equal(snapshot.graph.nodes[0].title, 'Installed');
`,
    );
    run(
      join(root, "node_modules/.bin/tsc"),
      [
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--module",
        "NodeNext",
        "--target",
        "ES2023",
        "--typeRoots",
        join(root, "node_modules/@types"),
        "--types",
        "node",
        probe,
      ],
      consumer,
    );
    run(process.execPath, [probe], consumer);
    const binary = join(consumer, "node_modules/.bin/lensmap-lsp");
    run(binary, ["--help"], consumer);
    const configured = spawnSync(binary, ["--configure-zed"], {
      cwd: consumer,
      encoding: "utf8",
    });
    assert.equal(configured.status, 0);
    const settings = JSON.parse(configured.stdout);
    assert.ok(settings.lsp.lensmap.binary.arguments[0].startsWith(consumer));
    run(
      "pnpm",
      [
        "exec",
        "playwright",
        "test",
        "--config",
        "apps/web/playwright.config.ts",
        "bridge.spec.ts",
      ],
      root,
      { ...process.env, LENSMAP_TEST_SERVER: binary },
    );
    console.log(
      "Isolated npm production install: public exports, executable, Zed settings and browser bridge passed.",
    );
  } finally {
    await rm(consumer, { recursive: true, force: true });
  }
}
