import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const site = process.env.LENSMAP_PACKAGE_CONSUMER
  ? resolve(process.env.LENSMAP_PACKAGE_CONSUMER, "astro-site")
  : fileURLToPath(new URL("site/", import.meta.url));
// The installed-consumer harness copies src/config; retain these root-owned data fixtures too.
if (process.env.LENSMAP_PACKAGE_CONSUMER) {
  for (const name of ["lensmap.config.json", "shared.lenstypes"]) {
    copyFileSync(new URL(`site/${name}`, import.meta.url), resolve(site, name));
  }
}

const cli = resolve(
  dirname(
    createRequire(resolve(site, "package.json")).resolve("astro/package.json"),
  ),
  "bin/astro.mjs",
);
function build(env = {}) {
  const result = spawnSync(process.execPath, [cli, "build"], {
    cwd: site,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
}
test("native Astro: entry-aware callback MDX, relative imports/assets, inert Markdown and stable generated files", () => {
  const deniedHost = spawnSync(process.execPath, [cli, "build"], {
    cwd: site,
    env: { ...process.env, LENSMAP_TEST_NO_MDX: "1" },
    encoding: "utf8",
  });
  assert.notEqual(deniedHost.status, 0);
  assert.match(
    deniedHost.stdout + deniedHost.stderr,
    /MDX admission requires the host @astrojs\/mdx integration/,
  );
  build();
  const trusted = readFileSync(resolve(site, "dist/a/map/index.html"), "utf8");
  const denied = readFileSync(resolve(site, "dist/b/map/index.html"), "utf8");
  assert.match(
    trusted,
    /data-witness>a\/map\|src\/maps\/a\/map.lensmap\|AUTHORED\|DEFAULT\| Authored /,
  );
  assert.match(trusted, /Result: 42/);
  assert.match(trusted, /src="\/_astro\/asset\.[^"]+\.svg"/);
  assert.doesNotMatch(trusted, /SERVER_METADATA_ONLY/);
  assert.match(denied, /Result: \{6 \* 7\}/);
  assert.match(denied, /“Smart quotes” – inherited Markdown/);
  assert.doesNotMatch(denied, /<script|MUST_NOT_EXECUTE/);
  assert.match(
    denied,
    /<img alt="Inert local asset" src="(?:\/_astro\/|data:image\/svg\+xml,)[^"]+"/,
  );
  const generated = resolve(site, "node_modules/.astro/lensmap");
  const files = readdirSync(generated).filter((name) =>
    name.endsWith(".astro"),
  );
  assert.equal(files.length, 2);
  const times = files.map((name) => statSync(resolve(generated, name)).mtimeMs);
  build();
  assert.deepEqual(
    files.map((name) => statSync(resolve(generated, name)).mtimeMs),
    times,
  );
});

test("native Astro refuses invalid configured vocabulary", () => {
  const path = resolve(site, "lensmap.config.json");
  const original = readFileSync(path, "utf8");
  try {
    writeFileSync(path, '{"types":"missing.lenstypes"}');
    const result = spawnSync(process.execPath, [cli, "build"], {
      cwd: site,
      env: process.env,
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stdout + result.stderr,
      /Invalid Lensmap project vocabulary/,
    );
  } finally {
    writeFileSync(path, original);
  }
});
