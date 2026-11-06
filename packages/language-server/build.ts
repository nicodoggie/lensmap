import { chmod, cp, rm } from "node:fs/promises";
import { resolve } from "node:path";

const assets = resolve(import.meta.dirname, "dist/preview");
await rm(assets, { recursive: true, force: true });
await cp(resolve(import.meta.dirname, "../../apps/web/dist"), assets, {
  recursive: true,
});
await chmod(resolve(import.meta.dirname, "dist/main.js"), 0o755);
