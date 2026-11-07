import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { releasePackages, requireExactVersion } from "./npm-cohort.ts";

function readIntegrity(name: string, version: string): string | undefined {
  try {
    const value: unknown = JSON.parse(
      execFileSync(
        "npm",
        [
          "view",
          `${name}@${version}`,
          "dist.integrity",
          "--json",
          "--registry",
          "https://registry.npmjs.org/",
          "--prefer-online",
        ],
        {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 60_000,
        },
      ),
    );
    if (typeof value !== "string")
      throw Error("Invalid registry integrity metadata.");
    return value;
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error
        ? String(error.stderr)
        : "";
    if (/npm error code E404\b/.test(stderr)) return undefined;
    throw error;
  }
}

type ReadbackOptions = {
  read?: (name: string, version: string) => string | undefined;
  wait?: (milliseconds: number) => Promise<unknown>;
  log?: (message: string) => void;
};

// Only use after reconciling the prior operation: E404 is not proof an accepted
// publication is absent while npm is still processing it. No mutation is retried.
export async function publishMissing(
  name: string,
  version: string,
  integrity: string,
  {
    publish,
    read = readIntegrity,
    ...options
  }: ReadbackOptions & { publish: () => void },
): Promise<void> {
  const actual = read(name, version);
  if (actual === undefined) {
    publish();
    await waitForPublished(name, version, integrity, { ...options, read });
  } else {
    await waitForPublished(name, version, integrity, {
      ...options,
      read: () => actual,
    });
  }
}

export async function waitForPublished(
  name: string,
  version: string,
  integrity: string,
  {
    read = readIntegrity,
    wait = setTimeout,
    log = console.log,
  }: ReadbackOptions = {},
): Promise<void> {
  const attempts = 60;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const actual = read(name, version);
    if (actual !== undefined) {
      if (actual !== integrity)
        throw Error(
          `${name}@${version} is a different artifact; do not republish it.`,
        );
      log(`Confirmed published artifact: ${name}@${version} ${integrity}`);
      return;
    }
    if (attempt < attempts - 1) await wait(5_000);
  }
  throw Error(
    `${name}@${version} is not available after bounded registry readback. Publication was not retried.`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        version: { type: "string" },
        "publish-missing": { type: "boolean", default: false },
      },
    });
    if (positionals.length !== 1)
      throw Error("Supply one verified package tarball and --version.");
    requireExactVersion(values.version ?? "");
    const tarball = resolve(positionals[0]);
    const manifest = JSON.parse(
      execFileSync("tar", ["-xOf", tarball, "package/package.json"], {
        encoding: "utf8",
      }),
    );
    if (
      !releasePackages.includes(manifest.name) ||
      typeof manifest.version !== "string" ||
      manifest.version !== values.version
    )
      throw Error(
        "Verified tarball must be a Lensmap package at the exact requested version.",
      );
    const integrity = `sha512-${createHash("sha512").update(readFileSync(tarball)).digest("base64")}`;
    if (values["publish-missing"]) {
      await publishMissing(manifest.name, manifest.version, integrity, {
        publish: () => {
          execFileSync(
            "npm",
            [
              "publish",
              tarball,
              "--access",
              "public",
              "--tag",
              "next",
              "--registry",
              "https://registry.npmjs.org/",
            ],
            { stdio: "inherit" },
          );
        },
      });
    } else {
      await waitForPublished(manifest.name, manifest.version, integrity);
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Registry readback failed.",
    );
    process.exitCode = 1;
  }
}
