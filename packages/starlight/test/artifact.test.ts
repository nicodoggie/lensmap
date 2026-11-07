import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
test("built viewer runtime and declarations stay inside the portable package boundary", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("package.json", root), "utf8"),
  );
  assert.equal(manifest.version, "0.2.0");
  assert.equal(manifest.dependencies["@lensmap/web"], undefined);
  assert.equal(manifest.devDependencies["@lensmap/web"], "workspace:*");
  for (const dependency of ["@lensmap/astro-loader", "@lensmap/document"])
    assert.equal(manifest.dependencies[dependency], "workspace:*");
  for (const name of readdirSync(new URL("dist/", root))) {
    if (!/\.(?:js|ts|css)$/.test(name)) continue;
    const code = readFileSync(new URL(`dist/${name}`, root), "utf8");
    assert.doesNotMatch(code, /(?:\/home\/|\/Users\/|@lensmap\/web)/);
    assert.doesNotMatch(code, /(?:from|import)\s*["'][^"']*apps\/web/);
  }
  const viewer = readFileSync(new URL("dist/ViewerHost.js", root), "utf8");
  assert.match(viewer, /function Viewer\(/);
  assert.match(viewer, /function ViewerConnections\(/);
  assert.match(viewer, /function SelectedThought\(/);
  assert.match(
    readFileSync(new URL("dist/layout.js", root), "utf8"),
    /function layoutSemanticGraph\(/,
  );
});
