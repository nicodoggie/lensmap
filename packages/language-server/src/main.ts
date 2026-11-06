#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { type RevealTarget, startServer } from "./server.js";

const { values } = parseArgs({
  options: {
    stdio: { type: "boolean" },
    assets: { type: "string" },
    zed: { type: "string", default: "zeditor" },
    "zed-data-dir": { type: "string" },
    "no-open": { type: "boolean" },
    "configure-zed": { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
});
const assets = resolve(
  values.assets ?? resolve(import.meta.dirname, "../../../apps/web/dist"),
);
if (values.help) {
  process.stdout.write(
    "Lensmap experimental language server + loopback preview\n\nUsage: lensmap-lsp --stdio [--assets PATH] [--zed EXECUTABLE]\n  --no-open          Return preview links without launching a browser\n  --zed-data-dir DIR  Target a private Zed profile for source reveal\n  --configure-zed    Print workspace settings for the local dev extension\n\nBuild first with pnpm build. Preview URLs/tokens are private per-run credentials;\nretrieve them through Lensmap's code actions or lensmap.session LSP command.\nEditor writes use revision checks/readback, not atomic compare-and-swap.\n",
  );
} else if (values["configure-zed"]) {
  process.stdout.write(
    `${JSON.stringify(
      {
        file_types: { YAML: ["lensmap"] },
        languages: { YAML: { language_servers: ["lensmap", "..."] } },
        lsp: {
          lensmap: {
            binary: {
              path: process.execPath,
              arguments: [
                fileURLToPath(import.meta.url),
                "--stdio",
                "--assets",
                assets,
                "--zed",
                values.zed,
              ],
            },
          },
        },
      },
      null,
      2,
    )}\n`,
  );
} else {
  const launch = (executable: string, args: string[]) =>
    new Promise<void>((done, reject) => {
      const child = spawn(executable, args, { stdio: "ignore" });
      child.once("error", () =>
        reject(new Error("Host opener could not start.")),
      );
      child.once("exit", (code) =>
        code === 0 ? done() : reject(new Error("Host opener failed.")),
      );
    });
  const reveal = async ({ uri, range, source }: RevealTarget) => {
    if (!uri.startsWith("file:"))
      throw new Error("This host reveals attached file documents only.");
    const line = source.split("\n")[range.start.line] ?? "";
    const column =
      Buffer.byteLength(line.slice(0, range.start.character), "utf8") + 1;
    const location = `${fileURLToPath(uri)}:${range.start.line + 1}:${column}`;
    await launch(values.zed ?? "zeditor", [
      ...(values["zed-data-dir"]
        ? ["--user-data-dir", values["zed-data-dir"]]
        : []),
      "--existing",
      location,
    ]);
  };
  try {
    const server = await startServer({
      input: process.stdin,
      output: process.stdout,
      assets,
      reveal,
      open: values["no-open"]
        ? undefined
        : async (url) => {
            if (process.platform !== "linux")
              throw new Error(
                "Browser launching is currently qualified on Linux only; use the returned preview URL.",
              );
            await launch("xdg-open", [url]);
          },
    });
    process.stderr.write(
      `Lensmap ready at ${server.origin}; use the Open preview code action.\n`,
    );
    const stop = () => {
      void server.close().finally(() => {
        process.stdin.destroy();
      });
    };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  } catch {
    process.stderr.write(
      "Lensmap could not start. Run pnpm build and check the asset directory; see --help.\n",
    );
    process.exitCode = 1;
  }
}
