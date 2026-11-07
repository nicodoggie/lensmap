import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  cohortDependencies,
  releasePackages,
  requireExactVersion,
} from "./npm-cohort.ts";

const root = resolve(import.meta.dirname, "..");
const artifacts = join(root, "artifacts/npm");
const { values } = parseArgs({ options: { test: { type: "boolean" } } });
function run(command: string, args: string[], cwd = root, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} ${args[0]} failed (${result.status}).`);
}

const manifests = await Promise.all(
  releasePackages.map(async (name) => {
    const directory = join(root, "packages", name.slice("@lensmap/".length));
    const manifest = JSON.parse(
      await readFile(join(directory, "package.json"), "utf8"),
    );
    assert.equal(manifest.name, name);
    requireExactVersion(manifest.version);
    return { name, directory, manifest };
  }),
);
for (const { manifest } of manifests)
  assert.equal(
    manifest.version,
    manifests[0].manifest.version,
    "Release the whole cohort at the same version.",
  );

run("pnpm", ["build"]);
await mkdir(artifacts, { recursive: true });
const tarballs: string[] = [];
for (const { name, directory, manifest } of manifests) {
  run("pnpm", ["pack", "--pack-destination", artifacts], directory);
  tarballs.push(
    join(
      artifacts,
      `${name.replace("@", "").replace("/", "-")}-${manifest.version}.tgz`,
    ),
  );
}

if (values.test) {
  const consumer = await realpath(
    await mkdtemp(join(tmpdir(), "lensmap-npm-")),
  );
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
import { readFileSync } from 'node:fs';
import { DocumentSession, DocumentSchema } from '@lensmap/document';
import { DocumentSchema as v1 } from '@lensmap/document/v1';
import { startServer } from '@lensmap/language-server';
import lensmap from '@lensmap/astro-loader';
import starlightLensmap from '@lensmap/starlight';
import type { GraphData, ViewerHostProps } from '@lensmap/starlight/viewer';
const connectionLabel: NonNullable<ViewerHostProps['getLabel']> = (node: GraphData['nodes'][number]) => node.title;
assert.equal(typeof connectionLabel, 'function');
assert.equal(lensmap().name, '@lensmap/astro-loader');
assert.equal(starlightLensmap().name, '@lensmap/astro-loader');
const dependencies: Record<string, string[]> = ${JSON.stringify(cohortDependencies)};
for (const [name, expectedDependencies] of Object.entries(dependencies)) {
  const manifest = JSON.parse(readFileSync(new URL('./node_modules/' + name + '/package.json', import.meta.url), 'utf8'));
  assert.equal(manifest.name, name);
  assert.equal(manifest.version, ${JSON.stringify(manifests[0].manifest.version)});
  for (const dependency of expectedDependencies)
    assert.equal(manifest.dependencies[dependency], manifest.version, name + ' must depend on the exact cohort artifact');
  assert.ok(import.meta.resolve(name).startsWith(new URL('./node_modules/', import.meta.url).href));
}
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
    for (const name of ["astro-loader", "starlight"]) {
      const fixture = join(root, "packages", name, "test/site");
      const target = join(
        consumer,
        name === "astro-loader" ? "astro-site" : "starlight-site",
      );
      await mkdir(target, { recursive: true });
      await cp(join(fixture, "src"), join(target, "src"), { recursive: true });
      await cp(
        join(fixture, "astro.config.mjs"),
        join(target, "astro.config.mjs"),
      );
      // These are independent host applications. Astro's framework-package
      // discovery needs their declared dependencies, not just ancestor modules.
      await writeFile(
        join(target, "package.json"),
        JSON.stringify({
          private: true,
          type: "module",
          dependencies: Object.assign(
            Object.fromEntries(
              manifests.map(({ name, manifest }) => [name, manifest.version]),
            ),
            ...manifests.map(({ manifest }) => manifest.peerDependencies ?? {}),
          ),
        }),
      );
      run(
        process.execPath,
        ["--test", join(root, "packages", name, "test/native.test.ts")],
        consumer,
        {
          ...process.env,
          LENSMAP_PACKAGE_CONSUMER: consumer,
        },
      );
    }
    const screenshots = join(artifacts, "consumer-evidence");
    await mkdir(screenshots, { recursive: true });
    for (const name of ["desktop", "mobile", "no-js"])
      await cp(
        join(consumer, "starlight-site/dist", `${name}.png`),
        join(screenshots, `${name}.png`),
      );
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
      "Isolated four-package npm production install: exact cohort dependencies and public declarations, native Astro/Starlight builds and browser reading/interaction, runtime executable, Zed settings and browser bridge passed.",
    );
  } finally {
    await rm(consumer, { recursive: true, force: true });
  }
}
