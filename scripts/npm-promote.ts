import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const registry = "https://registry.npmjs.org/";
const names = ["@lensmap/document", "@lensmap/language-server"] as const;
const registryArgs = ["--registry", registry, "--prefer-online"];
const number = "(?:0|[1-9]\\d*)";
const prerelease = "(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)";
const exactVersion = new RegExp(
  `^${number}\\.${number}\\.${number}(?:-${prerelease}(?:\\.${prerelease})*)?$`,
);

type Npm = (args: string[]) => string;
type Tags = Record<string, string>;
type Options = {
  npm?: Npm;
  dryRun?: boolean;
  wait?: (milliseconds: number) => Promise<unknown>;
  log?: (message: string) => void;
};

function runNpm(args: string[]): string {
  try {
    return execFileSync("npm", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    });
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error
        ? String(error.stderr)
        : "";
    const code = stderr.match(/npm error code ([A-Z0-9_]+)/)?.[1];
    throw new Error(
      `npm ${args[0]} failed (${code ?? "see npm authentication/configuration"}).`,
    );
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readTags(npm: Npm, name: string): Tags {
  const value: unknown = JSON.parse(
    npm(["view", name, "dist-tags", "--json", ...registryArgs]),
  );
  if (
    !record(value) ||
    Object.values(value).some((tag) => typeof tag !== "string")
  )
    throw new Error(`Invalid distribution tags for ${name}.`);
  return value as Tags;
}

export async function promoteLatest(
  version: string,
  {
    npm = runNpm,
    dryRun = false,
    wait = setTimeout,
    log = console.log,
  }: Options = {},
): Promise<void> {
  if (!exactVersion.test(version))
    throw new Error(
      "Supply an exact version such as 0.1.0, not a tag, range or whitespace-modified value.",
    );

  const before = new Map<string, Tags>();
  // Complete preflight for both packages before either latest tag can change.
  for (const name of names) {
    const manifest: unknown = JSON.parse(
      npm([
        "view",
        `${name}@${version}`,
        "name",
        "version",
        "dependencies",
        "--json",
        ...registryArgs,
      ]),
    );
    if (
      !record(manifest) ||
      manifest.name !== name ||
      manifest.version !== version
    )
      throw new Error(`Registry did not return the exact ${name}@${version}.`);
    if (
      name === names[1] &&
      (!record(manifest.dependencies) ||
        manifest.dependencies[names[0]] !== version)
    )
      throw new Error(
        "The language-server dependency must name the exact document version being promoted.",
      );
    before.set(name, readTags(npm, name));
  }
  log(
    `Promotion plan: ${JSON.stringify({ version, dryRun, previousTags: Object.fromEntries(before) })}`,
  );
  if (dryRun) return;

  const updated: string[] = [];
  try {
    for (const name of names) {
      if (before.get(name)?.latest === version) continue;
      npm(["dist-tag", "add", `${name}@${version}`, "latest", ...registryArgs]);
      updated.push(name);
      log(`Updated latest: ${name}@${version}`);
    }
    for (const name of names) {
      let confirmed = false;
      for (let attempt = 0; attempt < 12; attempt++) {
        const tags = readTags(npm, name);
        if (tags.next !== before.get(name)?.next)
          throw new Error(
            `${name}: next tag changed concurrently; reconcile registry state.`,
          );
        if (tags.latest === version) {
          confirmed = true;
          log(`Confirmed tags: ${name} ${JSON.stringify(tags)}`);
          break;
        }
        if (attempt < 11) await wait(5_000);
      }
      if (!confirmed)
        throw new Error(
          `${name}: latest readback did not confirm ${version}; do not repeat writes without reconciliation.`,
        );
    }
  } catch (error) {
    throw new Error(
      `Updated latest: ${updated.join(", ") || "none confirmed"}. Distribution tags are not transactional; no automatic rollback or mutation retry was attempted. ${error instanceof Error ? error.message : "Promotion failed."}`,
    );
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const { values } = parseArgs({
      options: {
        version: { type: "string" },
        "dry-run": { type: "boolean", default: false },
      },
    });
    await promoteLatest(values.version ?? "", {
      dryRun: values["dry-run"],
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Promotion failed.");
    process.exitCode = 1;
  }
}
