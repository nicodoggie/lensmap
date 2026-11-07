import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const cwd = fileURLToPath(new URL(".", import.meta.url));
rmSync(new URL("dist/", import.meta.url), { recursive: true, force: true });
mkdirSync(new URL("dist/", import.meta.url), { recursive: true });
await build({
  absWorkingDir: cwd,
  entryPoints: { index: "src/index.ts" },
  outdir: "dist",
  bundle: true,
  packages: "external",
  format: "esm",
  platform: "neutral",
  target: "es2023",
  jsx: "automatic",
  minify: false,
  legalComments: "none",
});
cpSync(
  new URL("src/components/", import.meta.url),
  new URL("dist/components/", import.meta.url),
  { recursive: true },
);
const types = spawnSync(
  process.execPath,
  [
    fileURLToPath(
      new URL("./bin/tsc", import.meta.resolve("typescript/package.json")),
    ),
    "-p",
    "tsconfig.json",
  ],
  { cwd, stdio: "inherit" },
);
if (types.status !== 0) process.exit(types.status ?? 1);
