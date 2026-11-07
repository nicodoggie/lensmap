import assert from "node:assert/strict";
import { test } from "node:test";
import { promoteLatest } from "./npm-promote.ts";

const names = ["@lensmap/document", "@lensmap/language-server"] as const;
const version = "0.1.0";

function fixture(includeAstro = false, version = "0.1.0") {
  const cohort = includeAstro
    ? [...names, "@lensmap/astro-loader", "@lensmap/starlight"]
    : [...names];
  const calls: string[][] = [];
  const manifests: Record<string, unknown> = {
    [names[0]]: { name: names[0], version },
    [names[1]]: {
      name: names[1],
      version,
      dependencies: { [names[0]]: version },
    },
  };
  const tags: Record<string, Record<string, string>> = {
    [names[0]]: { latest: "0.0.9", next: "0.2.0" },
    [names[1]]: { latest: "0.0.9", next: "0.2.0" },
  };
  if (includeAstro) {
    for (const name of cohort.slice(2)) {
      manifests[name] = {
        name,
        version,
        dependencies: {
          [names[0]]: version,
          ...(name === "@lensmap/starlight"
            ? { "@lensmap/astro-loader": version }
            : {}),
        },
      };
      tags[name] = { latest: "0.0.9", next: "0.2.0" };
    }
  }
  let failWrite: string | undefined;
  let changeNext = false;
  let staleReads = 0;
  const npm = (args: string[]): string => {
    calls.push(args);
    assert.ok(args.includes("https://registry.npmjs.org/"));
    if (args[0] === "view") {
      if (args[2] === "dist-tags") {
        const current = tags[args[1]];
        if (staleReads > 0 && current.latest === version) {
          staleReads--;
          return JSON.stringify({ ...current, latest: "0.0.9" });
        }
        return JSON.stringify(current);
      }
      const name = cohort.find((name) => args[1] === `${name}@${version}`);
      if (!name || !manifests[name]) throw new Error("npm view failed (E404)");
      return JSON.stringify(manifests[name]);
    }
    assert.deepEqual(args.slice(0, 2), ["dist-tag", "add"]);
    const name = cohort.find((name) => args[2] === `${name}@${version}`);
    assert.ok(name);
    assert.equal(args[3], "latest");
    if (name === failWrite) throw new Error("npm dist-tag failed (E403)");
    tags[name].latest = version;
    if (changeNext) tags[name].next = "unexpected";
    return "";
  };
  return {
    calls,
    manifests,
    tags,
    options: { npm, wait: async () => {}, log: () => {} },
    failOn: (name: string) => {
      failWrite = name;
    },
    alterNext: () => {
      changeNext = true;
    },
    staleFor: (reads: number) => {
      staleReads = reads;
    },
  };
}

const writes = (calls: string[][]) =>
  calls.filter((args) => args[0] === "dist-tag");

test("explicit Astro selection preflights and promotes all four packages", async () => {
  const version = "0.2.0";
  const f = fixture(true, version);
  await promoteLatest(version, { ...f.options, includeAstro: true });
  assert.equal(writes(f.calls).length, 4);
  const firstWrite = f.calls.findIndex((args) => args[0] === "dist-tag");
  const preflight = f.calls.slice(0, firstWrite);
  for (const name of Object.keys(f.manifests)) {
    assert.ok(preflight.some((args) => args[1] === `${name}@${version}`));
    assert.ok(
      preflight.some((args) => args[1] === name && args[2] === "dist-tags"),
    );
  }
  for (const tags of Object.values(f.tags))
    assert.deepEqual(tags, { latest: version, next: "0.2.0" });
});

test("all Astro dependency edges must be exact before any mutation", async () => {
  for (const [name, dependency] of [
    ["@lensmap/astro-loader", "@lensmap/document"],
    ["@lensmap/starlight", "@lensmap/document"],
    ["@lensmap/starlight", "@lensmap/astro-loader"],
  ]) {
    const version = "0.2.0";
    const f = fixture(true, version);
    const manifest = f.manifests[name] as {
      dependencies: Record<string, string>;
    };
    manifest.dependencies[dependency] = `^${version}`;
    await assert.rejects(
      promoteLatest(version, { ...f.options, includeAstro: true }),
      /dependency/,
    );
    assert.equal(writes(f.calls).length, 0);
  }
});

test("missing Astro package prevents writes to the runtime pair", async () => {
  const version = "0.2.0";
  const f = fixture(true, version);
  delete f.manifests["@lensmap/starlight"];
  await assert.rejects(
    promoteLatest(version, { ...f.options, includeAstro: true }),
    /E404/,
  );
  assert.equal(writes(f.calls).length, 0);
});

test("runtime-only selection does not infer Astro packages from a newer version", async () => {
  const version = "0.2.0";
  const f = fixture(false, version);
  await promoteLatest(version, f.options);
  assert.equal(writes(f.calls).length, 2);
  assert.ok(
    f.calls.every(
      (args) => !args.some((arg) => /astro-loader|starlight/.test(arg)),
    ),
  );
});

test("Astro dry run preflights the full cohort without changing tags", async () => {
  const version = "0.2.0";
  const f = fixture(true, version);
  await promoteLatest(version, {
    ...f.options,
    includeAstro: true,
    dryRun: true,
  });
  for (const name of Object.keys(f.manifests)) {
    assert.ok(f.calls.some((args) => args[1] === `${name}@${version}`));
    assert.ok(
      f.calls.some((args) => args[1] === name && args[2] === "dist-tags"),
    );
  }
  assert.equal(writes(f.calls).length, 0);
});

test("failure at the final cohort tag reports previous writes without rollback or retry", async () => {
  const version = "0.2.0";
  const f = fixture(true, version);
  f.failOn("@lensmap/starlight");
  await assert.rejects(
    promoteLatest(version, { ...f.options, includeAstro: true }),
    /Updated latest: @lensmap\/document, @lensmap\/language-server, @lensmap\/astro-loader.*not transactional/,
  );
  assert.equal(writes(f.calls).length, 4);
  assert.equal(f.tags["@lensmap/starlight"].latest, "0.0.9");
});

test("checks both manifests and tag snapshots before any latest-only write", async () => {
  const f = fixture();
  await promoteLatest(version, f.options);
  assert.equal(writes(f.calls).length, 2);
  const firstWrite = f.calls.findIndex((args) => args[0] === "dist-tag");
  for (const name of names) {
    assert.ok(
      f.calls
        .slice(0, firstWrite)
        .some((args) => args[1] === `${name}@${version}`),
    );
    assert.ok(
      f.calls
        .slice(0, firstWrite)
        .some((args) => args[1] === name && args[2] === "dist-tags"),
    );
    assert.deepEqual(f.tags[name], { latest: version, next: "0.2.0" });
  }
  assert.ok(
    f.calls.every(
      (args) => !args.includes("publish") && !args.includes("install"),
    ),
  );
});

test("dry run reads real promotion prerequisites but makes no writes", async () => {
  const f = fixture();
  await promoteLatest(version, { ...f.options, dryRun: true });
  assert.equal(writes(f.calls).length, 0);
  assert.equal(f.tags[names[0]].latest, "0.0.9");
});

test("rejects empty, non-exact and whitespace-modified versions before calling npm", async () => {
  for (const input of [
    "",
    "latest",
    "next",
    "^0.1.0",
    "0.1",
    "v0.1.0",
    " 0.1.0",
    "0.1.0\n",
    "0.1.0;echo unsafe",
    "01.2.3",
    "1.02.3",
    "1.2.03",
    "0.1.0-01",
  ]) {
    const f = fixture();
    await assert.rejects(promoteLatest(input, f.options), /exact version/);
    assert.equal(f.calls.length, 0);
  }
});

test("missing second package fails before either tag changes", async () => {
  const f = fixture();
  delete f.manifests[names[1]];
  await assert.rejects(promoteLatest(version, f.options), /E404/);
  assert.equal(writes(f.calls).length, 0);
});

test("rejects registry identity/version mismatches before writing", async () => {
  for (const manifest of [
    null,
    [],
    { name: names[1], version: "0.1.1" },
    { name: "another-package", version },
  ]) {
    const f = fixture();
    f.manifests[names[1]] = manifest;
    await assert.rejects(promoteLatest(version, f.options));
    assert.equal(writes(f.calls).length, 0);
  }
});

test("rejects a server depending on a different engine version before writing", async () => {
  const f = fixture();
  f.manifests[names[1]] = {
    name: names[1],
    version,
    dependencies: { [names[0]]: "0.0.9" },
  };
  await assert.rejects(promoteLatest(version, f.options), /dependency/);
  assert.equal(writes(f.calls).length, 0);
});

test("reports partial completion without rollback or repeated mutation", async () => {
  const f = fixture();
  f.failOn(names[1]);
  await assert.rejects(
    promoteLatest(version, f.options),
    /Updated latest: @lensmap\/document.*not transactional/s,
  );
  assert.equal(writes(f.calls).length, 2);
  assert.equal(f.tags[names[0]].latest, version);
  assert.equal(f.tags[names[1]].latest, "0.0.9");
});

test("an already-promoted release is read back without any mutation", async () => {
  const f = fixture();
  for (const name of names) f.tags[name].latest = version;
  await promoteLatest(version, f.options);
  assert.equal(writes(f.calls).length, 0);
});

test("retries stale registry readback, never the tag mutation", async () => {
  const f = fixture();
  f.staleFor(2);
  await promoteLatest(version, f.options);
  assert.equal(writes(f.calls).length, 2);
});

test("can roll latest back to an older published version without moving next", async () => {
  const f = fixture();
  for (const name of names) f.tags[name].latest = "0.2.0";
  await promoteLatest(version, f.options);
  for (const name of names)
    assert.deepEqual(f.tags[name], { latest: version, next: "0.2.0" });
});

test("malformed tag metadata fails before any write", async () => {
  const f = fixture();
  await assert.rejects(
    promoteLatest(version, {
      ...f.options,
      npm: (args) => (args[2] === "dist-tags" ? "null" : f.options.npm(args)),
    }),
    /Invalid distribution tags/,
  );
  assert.equal(writes(f.calls).length, 0);
});

test("fails bounded readback when latest cannot be confirmed", async () => {
  const f = fixture();
  f.staleFor(100);
  await assert.rejects(promoteLatest(version, f.options), /readback/);
  assert.equal(writes(f.calls).length, 2);
});

test("detects a concurrent next-tag change instead of claiming next was preserved", async () => {
  const f = fixture();
  f.alterNext();
  await assert.rejects(promoteLatest(version, f.options), /next.*changed/);
});
