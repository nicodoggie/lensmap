import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-languageserver/node";

test.use({ trace: "off" }); // Per-run authorization must not enter retained traces.
const original = `version: v1
nodes:
  - id: alpha
    summary: Alpha
    position: {x: 0, y: 0}
    connections: [{node_id: beta}]
  - id: beta
    summary: Beta
    position: {x: 240, y: 120}
`;
async function editor() {
  const web = fileURLToPath(new URL("..", import.meta.url));
  const scratch = await mkdtemp(join(tmpdir(), "lensmap-browser-"));
  const file = join(scratch, "notes.lensmap");
  const log = join(scratch, "reveal.jsonl");
  const opener = join(scratch, "synthetic-host");
  await writeFile(file, original);
  await writeFile(
    opener,
    "#!/usr/bin/env node\nrequire('node:fs').appendFileSync(process.env.LENSMAP_REVEAL_LOG, JSON.stringify(process.argv.slice(2))+'\\n');\n",
    { mode: 0o700 },
  );
  const child = spawn(
    process.execPath,
    [
      process.env.LENSMAP_TEST_SERVER ??
        resolve(web, "../../packages/language-server/dist/main.js"),
      "--stdio",
      "--no-open",
      "--zed",
      opener,
    ],
    {
      cwd: scratch,
      env: { ...process.env, LENSMAP_REVEAL_LOG: log },
      stdio: "pipe",
    },
  );
  // Consume stderr without publishing local credentials or private protocol data.
  child.stderr.resume();
  const exited = new Promise<void>((done) => child.once("exit", () => done()));
  const client = createMessageConnection(
    new StreamMessageReader(child.stdout),
    new StreamMessageWriter(child.stdin),
  );
  client.listen();
  await client.sendRequest("initialize", {
    processId: null,
    capabilities: { workspace: { applyEdit: true } },
  });
  await client.sendNotification("initialized", {});
  const session = await client.sendRequest<{
    origin: string;
    previewURL: string;
    apiToken: string;
  }>("workspace/executeCommand", { command: "lensmap.session" });
  const uri = pathToFileURL(file).href;
  let source = original;
  let version = 1;
  const headers = { Authorization: `Bearer ${session.apiToken}` };
  const snapshot = async () =>
    (
      await fetch(
        `${session.origin}/api/document?uri=${encodeURIComponent(uri)}`,
        { headers },
      )
    ).json();
  await client.sendNotification("textDocument/didOpen", {
    textDocument: { uri, version, languageId: "yaml", text: source },
  });
  await expect.poll(async () => (await snapshot()).valid).toBe(true);
  const change = async (next: string) => {
    source = next;
    await client.sendNotification("textDocument/didChange", {
      textDocument: { uri, version: ++version },
      contentChanges: [{ text: source }],
    });
    await expect
      .poll(async () => (await snapshot()).analyzedRevision)
      .toBe(version);
  };
  client.onRequest(
    "workspace/applyEdit",
    async (params: {
      edit: {
        documentChanges: {
          edits: {
            range: {
              start: { line: number; character: number };
              end: { line: number; character: number };
            };
            newText: string;
          }[];
        }[];
      };
    }) => {
      const offset = (p: { line: number; character: number }) =>
        source
          .split("\n")
          .slice(0, p.line)
          .reduce((n, line) => n + line.length + 1, 0) + p.character;
      const edits = params.edit.documentChanges[0].edits.map((edit) => ({
        start: offset(edit.range.start),
        end: offset(edit.range.end),
        text: edit.newText,
      }));
      let next = source;
      for (const edit of edits.sort((a, b) => b.start - a.start))
        next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
      await change(next);
      return { applied: true };
    },
  );
  const go = async (page: Page) => {
    // Bootstrap through the real browser, but never rethrow URL-bearing errors.
    try {
      await page.goto(session.previewURL);
    } catch {
      throw new Error("Preview navigation failed (private URL withheld)");
    }
    await expect(page.getByTestId("bridge-status")).toContainText("Live");
  };
  const close = async () => {
    if (child.exitCode === null) {
      try {
        await client.sendRequest("shutdown");
        await client.sendNotification("exit");
      } catch {
        child.kill("SIGTERM");
      }
      const timer = setTimeout(() => child.kill("SIGKILL"), 2000);
      await exited;
      clearTimeout(timer);
    }
    client.dispose();
    await rm(scratch, { recursive: true, force: true });
  };
  return {
    ...session,
    uri,
    file,
    log,
    client,
    snapshot,
    change,
    go,
    close,
    headers,
  };
}

test("unsaved live source preserves exploration, keeps an invalid last map and follows a caret without taking focus", async ({
  page,
}, info) => {
  const f = await editor();
  try {
    await f.go(page);
    expect(new URL(page.url()).hash).toBe("");
    await expect(
      page.getByRole("textbox", { name: "YAML source" }),
    ).toHaveCount(0);
    const alpha = page.getByRole("button", { name: "Alpha", exact: true });
    const beta = page.getByRole("button", { name: "Beta", exact: true });
    await beta.focus();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    const zoom = await page
      .getByLabel("Zoom level", { exact: true })
      .textContent();
    const geometry = await page
      .locator("[data-node]")
      .evaluateAll((nodes) =>
        nodes.map((node) => [
          node.getAttribute("data-node"),
          node.getAttribute("style"),
        ]),
      );
    const originalKey = await beta.getAttribute("data-node");
    await f.change(
      original.replace(
        "summary: Beta",
        'summary: Beta\n    full_text: "Beta\\nUnsaved prose"',
      ),
    );
    await expect(page.getByTestId("bridge-status")).toContainText("r2");
    await expect(beta).toHaveAttribute("aria-pressed", "true");
    expect(await beta.getAttribute("data-node")).toBe(originalKey);
    expect(
      await page.getByLabel("Zoom level", { exact: true }).textContent(),
    ).toBe(zoom);
    expect(
      await page
        .locator("[data-node]")
        .evaluateAll((nodes) =>
          nodes.map((node) => [
            node.getAttribute("data-node"),
            node.getAttribute("style"),
          ]),
        ),
    ).toEqual(geometry);
    await f.change("version: v1\nnodes: [");
    await expect(page.getByTestId("bridge-status")).toContainText("stale");
    await expect(beta).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("YAML");
    await f.change(original);
    await expect(page.getByTestId("bridge-status")).toContainText("Live");
    const follow = page.getByRole("checkbox", { name: "Follow editor caret" });
    await follow.check();
    await follow.focus();
    await f.client.sendRequest("textDocument/documentHighlight", {
      textDocument: { uri: f.uri },
      position: { line: 3, character: 14 },
    });
    await expect(alpha).toHaveAttribute("aria-pressed", "true");
    await expect(follow).toBeFocused();
    const centred = await alpha.getAttribute("style");
    await page.getByRole("application", { name: "Spatial map" }).focus();
    await page.keyboard.down("ArrowRight");
    await expect
      .poll(async () => alpha.getAttribute("style"))
      .not.toBe(centred);
    await page.keyboard.up("ArrowRight");
    const explored = await alpha.getAttribute("style");
    if (explored === null)
      throw new Error("Expected rendered thought geometry.");
    await f.client.sendRequest("textDocument/documentHighlight", {
      textDocument: { uri: f.uri },
      position: { line: 3, character: 15 },
    });
    await expect(alpha).toHaveAttribute("style", explored);
    await page
      .getByRole("button", { name: "Thought details", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Reveal source", exact: true })
      .click();
    await expect
      .poll(async () => {
        try {
          return JSON.parse((await readFile(f.log, "utf8")).trim())[0];
        } catch {
          return "";
        }
      })
      .toBe("--existing");
    expect(await readFile(f.file, "utf8")).toBe(original);
    await page.screenshot({
      path: info.outputPath("live-preview-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 430, height: 850 });
    await expect(
      page.getByRole("application", { name: "Spatial map" }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath("live-preview-narrow.png"),
      fullPage: true,
    });
    await f.close();
    await expect(page.getByTestId("bridge-status")).toContainText(
      "Disconnected",
    );
    await expect(alpha).toBeVisible();
  } finally {
    await f.close();
  }
});

test("reopening the same URI and revision renders the new attachment rather than cached source", async ({
  page,
}) => {
  const f = await editor();
  try {
    await f.go(page);
    await expect(
      page.getByRole("button", { name: "Alpha", exact: true }),
    ).toBeVisible();
    await f.client.sendNotification("textDocument/didClose", {
      textDocument: { uri: f.uri },
    });
    await expect(page.getByTestId("bridge-status")).toContainText("Waiting");
    await f.client.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: f.uri,
        version: 1,
        languageId: "yaml",
        text: original.replace("Alpha", "Reopened content"),
      },
    });
    await expect(page.getByTestId("bridge-status")).toContainText("Live · r1");
    await expect(
      page.getByRole("button", { name: "Reopened content", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Alpha", exact: true }),
    ).toHaveCount(0);
    // Also cover replacement without observing an intermediate detached state
    // (for example, reconnecting the event stream after a close/reopen).
    await f.client.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: f.uri,
        version: 1,
        languageId: "yaml",
        text: original.replace("Alpha", "Replacement content"),
      },
    });
    await expect(
      page.getByRole("button", { name: "Replacement content", exact: true }),
    ).toBeVisible();
  } finally {
    await f.close();
  }
});

test("focused semantic content edits round-trip through real stdio buffer readback", async ({
  page,
}) => {
  const f = await editor();
  try {
    await f.go(page);
    const snapshot = await f.snapshot();
    const response = await fetch(`${f.origin}/api/content`, {
      method: "POST",
      headers: { ...f.headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        uri: f.uri,
        key: snapshot.graph.nodes[0].key,
        baseRevision: snapshot.revision,
        patch: { summary: "Agent edit" },
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "confirmed",
      revision: 2,
    });
    await expect(
      page.getByRole("button", { name: "Agent edit", exact: true }),
    ).toBeVisible();
    expect(await readFile(f.file, "utf8")).toBe(original);
  } finally {
    await f.close();
  }
});
