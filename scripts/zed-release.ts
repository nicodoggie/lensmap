import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const root = resolve(import.meta.dirname, "..");
const extension = join(root, "editors/zed");
const artifacts = join(root, "artifacts/zed");
const { values } = parseArgs({
  options: { test: { type: "boolean" }, tag: { type: "string" } },
});
function run(command: string, args: string[], cwd = root, capture = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr);
    throw new Error(`${command} ${args[0]} failed (${result.status}).`);
  }
  return result.stdout;
}
const manifest = JSON.parse(
  run(
    "python3",
    [
      "-c",
      "import json,tomllib; print(json.dumps(tomllib.load(open('extension.toml','rb'))))",
    ],
    extension,
    true,
  ),
);
const metadata = JSON.parse(
  run(
    "cargo",
    [
      "metadata",
      "--locked",
      "--no-deps",
      "--format-version",
      "1",
      "--manifest-path",
      "editors/zed/Cargo.toml",
    ],
    root,
    true,
  ),
);
assert.equal(
  manifest.version,
  metadata.packages[0].version,
  "Extension and Cargo versions must match.",
);
if (values.tag) {
  assert.equal(
    values.tag,
    `zed-v${manifest.version}`,
    "Tag must match extension.toml.",
  );
}
run("cargo", [
  "build",
  "--locked",
  "--manifest-path",
  "editors/zed/Cargo.toml",
  "--target",
  "wasm32-wasip2",
  "--release",
]);
const scratch = await mkdtemp(join(tmpdir(), "lensmap-zed-release-"));
try {
  const name = `${manifest.id}-${manifest.version}`;
  const stage = join(scratch, name);
  await mkdir(stage);
  for (const file of [
    "Cargo.toml",
    "Cargo.lock",
    "extension.toml",
    "LICENSE",
    "README.md",
    "server-version",
    "src",
  ]) {
    await cp(join(extension, file), join(stage, file), {
      recursive: true,
      dereference: true,
    });
  }
  await cp(
    join(metadata.target_directory, "wasm32-wasip2/release/lensmap_zed.wasm"),
    join(stage, "extension.wasm"),
  );
  await mkdir(artifacts, { recursive: true });
  const archive = `${name}.tar.gz`;
  run("tar", ["-czf", join(artifacts, archive), "-C", scratch, name]);
  const checksum = createHash("sha256")
    .update(await readFile(join(artifacts, archive)))
    .digest("hex");
  await writeFile(join(artifacts, "SHA256SUMS"), `${checksum}  ${archive}\n`);
  if (values.test) {
    const extracted = join(scratch, "extracted");
    await mkdir(extracted);
    run("python3", [
      "-c",
      "import sys,tarfile; tarfile.open(sys.argv[1]).extractall(sys.argv[2], filter='data')",
      join(artifacts, archive),
      extracted,
    ]);
    const consumer = join(extracted, name);
    run(
      "cargo",
      ["build", "--locked", "--target", "wasm32-wasip2", "--release"],
      consumer,
    );
    run("sha256sum", ["--check", "SHA256SUMS"], artifacts);
  }
  console.log(
    `Prepared ${join(artifacts, archive)} (source + Wasm, not a Zed registry publication).`,
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
