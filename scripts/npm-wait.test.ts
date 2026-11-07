import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { publishMissing, waitForPublished } from "./npm-wait.ts";

// Exercise the actual CLI, tar extraction, SHA512 calculation and npm argv at
// the process boundary. npm is a local test double; these tests never use a registry.
function cliFixture(name: string, version: string) {
  const directory = mkdtempSync(join(tmpdir(), "lensmap-release-test-"));
  mkdirSync(join(directory, "package"));
  writeFileSync(
    join(directory, "package/package.json"),
    JSON.stringify({ name, version }),
  );
  const tarball = join(directory, "retained.tgz");
  execFileSync("tar", ["-czf", tarball, "-C", directory, "package"]);
  const integrity = `sha512-${createHash("sha512").update(readFileSync(tarball)).digest("base64")}`;
  writeFileSync(join(directory, "registry.json"), JSON.stringify(integrity));
  writeFileSync(
    join(directory, "npm"),
    `#!${process.execPath}
const { appendFileSync, readFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const args = process.argv.slice(2);
appendFileSync(process.env.CALLS, JSON.stringify(args) + '\\n');
if (args[0] === 'publish') {
  const integrity = 'sha512-' + createHash('sha512').update(readFileSync(args[1])).digest('base64');
  writeFileSync(process.env.REGISTRY, JSON.stringify(integrity));
} else {
  const value = JSON.parse(readFileSync(process.env.REGISTRY));
  if (value === null) { console.error('npm error code E404'); process.exit(1); }
  console.log(JSON.stringify(value));
}
`,
    { mode: 0o755 },
  );
  return {
    integrity,
    tarball,
    setRegistry: (value: string | null) =>
      writeFileSync(join(directory, "registry.json"), JSON.stringify(value)),
    run: (requestedVersion = version, publishMissing = false) => {
      const args = [
        join(import.meta.dirname, "npm-wait.ts"),
        tarball,
        "--version",
        requestedVersion,
      ];
      if (publishMissing) args.push("--publish-missing");
      const result = spawnSync(process.execPath, args, {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          CALLS: join(directory, "calls.jsonl"),
          REGISTRY: join(directory, "registry.json"),
        },
      });
      return result;
    },
    calls: () =>
      readFileSync(join(directory, "calls.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as string[]),
    close: () => rmSync(directory, { recursive: true, force: true }),
  };
}

test("readiness CLI accepts both historical runtime and new Astro retained tarballs", () => {
  for (const [name, version] of [
    ["@lensmap/document", "0.1.1"],
    ["@lensmap/language-server", "0.1.1"],
    ["@lensmap/astro-loader", "0.2.0"],
    ["@lensmap/starlight", "0.2.0"],
  ]) {
    const f = cliFixture(name, version);
    try {
      const result = f.run();
      assert.equal(result.status, 0, result.stderr);
      assert.ok(result.stdout.includes(f.integrity));
      assert.deepEqual(f.calls(), [
        [
          "view",
          `${name}@${version}`,
          "dist.integrity",
          "--json",
          "--registry",
          "https://registry.npmjs.org/",
          "--prefer-online",
        ],
      ]);
    } finally {
      f.close();
    }
  }
});

test("recovery CLI publishes the original tarball once with explicit public next registry flags", () => {
  const f = cliFixture("@lensmap/starlight", "0.2.0");
  try {
    f.setRegistry(null);
    const result = f.run("0.2.0", true);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      f.calls().filter((args) => args[0] === "publish"),
      [
        [
          "publish",
          f.tarball,
          "--access",
          "public",
          "--tag",
          "next",
          "--registry",
          "https://registry.npmjs.org/",
        ],
      ],
    );
    assert.ok(result.stdout.includes(f.integrity));
    assert.equal(f.run("0.2.0", true).status, 0);
    assert.equal(f.calls().filter((args) => args[0] === "publish").length, 1);
  } finally {
    f.close();
  }
});

test("recovery CLI rejects mismatched registry integrity without publishing", () => {
  const f = cliFixture("@lensmap/astro-loader", "0.2.0");
  try {
    f.setRegistry("sha512-other");
    const result = f.run("0.2.0", true);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /different artifact/);
    assert.equal(f.calls().filter((args) => args[0] === "publish").length, 0);
  } finally {
    f.close();
  }
});

test("readiness CLI rejects other package identities and mismatched versions before npm", () => {
  for (const [name, requested] of [
    ["@other/package", "0.2.0"],
    ["@lensmap/starlight", "0.1.1"],
    ["@lensmap/starlight", " 0.2.0"],
  ]) {
    const f = cliFixture(name, "0.2.0");
    try {
      const result = f.run(requested, true);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /exact/);
      assert.throws(f.calls, /ENOENT/);
    } finally {
      f.close();
    }
  }
});

test("recovery publishes missing retained bytes once, then requires matching integrity", async () => {
  let visible = false;
  let writes = 0;
  await publishMissing("@lensmap/astro-loader", "0.2.0", "sha512-expected", {
    read: () => (visible ? "sha512-expected" : undefined),
    publish: () => {
      writes++;
      visible = true;
    },
    wait: async () => {},
    log: () => {},
  });
  assert.equal(writes, 1);
});

test("accepted recovery publication with missing readback is never published again", async () => {
  let writes = 0;
  await assert.rejects(
    publishMissing("@lensmap/astro-loader", "0.2.0", "sha512-expected", {
      read: () => undefined,
      publish: () => {
        writes++;
      },
      wait: async () => {},
      log: () => {},
    }),
    /not available.*not retried/,
  );
  assert.equal(writes, 1);
});

test("recovery never republishes accepted or mismatched artifacts", async () => {
  for (const actual of ["sha512-expected", "sha512-other"]) {
    const operation = publishMissing(
      "@lensmap/starlight",
      "0.2.0",
      "sha512-expected",
      {
        read: () => actual,
        publish: () =>
          assert.fail(
            "Visible immutable versions must not be published again.",
          ),
        wait: async () => {},
        log: () => {},
      },
    );
    if (actual === "sha512-other")
      await assert.rejects(operation, /different artifact/);
    else await operation;
  }
});

test("recovery fails closed on registry and publish errors without mutation retries", async () => {
  let writes = 0;
  await assert.rejects(
    publishMissing("@lensmap/starlight", "0.2.0", "sha512-expected", {
      read: () => {
        throw Error("E403");
      },
      publish: () => {
        writes++;
      },
    }),
    /E403/,
  );
  assert.equal(writes, 0);
  await assert.rejects(
    publishMissing("@lensmap/starlight", "0.2.0", "sha512-expected", {
      read: () => undefined,
      publish: () => {
        writes++;
        throw Error("publish response lost; reconcile before rerun");
      },
    }),
    /reconcile/,
  );
  assert.equal(writes, 1);
});

test("waits for registry processing without retrying a publication", async () => {
  let reads = 0;
  let waits = 0;
  await waitForPublished("@lensmap/document", "0.1.1", "sha512-expected", {
    read: () => (++reads < 3 ? undefined : "sha512-expected"),
    wait: async () => {
      waits++;
    },
    log: () => {},
  });
  assert.equal(reads, 3);
  assert.equal(waits, 2);
});

test("rejects a different immutable artifact immediately", async () => {
  await assert.rejects(
    waitForPublished("@lensmap/document", "0.1.1", "sha512-expected", {
      read: () => "sha512-other",
      wait: async () => {
        assert.fail("Integrity mismatches are not processing delays.");
      },
      log: () => {},
    }),
    /different artifact/,
  );
});

test("stops bounded missing-version readback and does not conceal other failures", async () => {
  let reads = 0;
  await assert.rejects(
    waitForPublished("@lensmap/document", "0.1.1", "sha512-expected", {
      read: () => {
        reads++;
        return undefined;
      },
      wait: async () => {},
      log: () => {},
    }),
    /not available/,
  );
  assert.equal(reads, 60);
  await assert.rejects(
    waitForPublished("@lensmap/document", "0.1.1", "sha512-expected", {
      read: () => {
        throw Error("authentication failed");
      },
      wait: async () => {
        assert.fail("Authentication failures must not be retried.");
      },
      log: () => {},
    }),
    /authentication failed/,
  );
});
