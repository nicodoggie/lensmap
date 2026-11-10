import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { pathToFileURL } from "node:url";
import { offsetToPosition, positionToOffset } from "@lensmap/document";
import { afterEach, describe, expect, it } from "vitest";
import {
  type CompletionItem,
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-languageserver/node";
import { startServer } from "./server.js";

const uri = "file:///synthetic/notes.lensmap";
const source =
  "version: v1\nnodes:\n  - id: alpha\n    summary: Alpha\n    connections:\n      - id: beta\n        full_text: Beta\n      - node_id: alpha\n";
const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function fixture(showDocument = false, projectRoot?: string) {
  const assets = await mkdtemp(join(tmpdir(), "lensmap-server-"));
  cleanups.push(() => rm(assets, { recursive: true, force: true }));
  await writeFile(
    join(assets, "preview.html"),
    "<!doctype html><title>Synthetic asset</title>",
  );
  const input = new PassThrough();
  const output = new PassThrough();
  const revealed: unknown[] = [];
  const server = await startServer({
    input,
    output,
    assets,
    debounceMs: 5,
    readbackTimeoutMs: 40,
    reveal: async (target) => {
      revealed.push(target);
    },
  });
  const client = createMessageConnection(
    new StreamMessageReader(output),
    new StreamMessageWriter(input),
  );
  const opened: unknown[] = [];
  client.onRequest("window/showDocument", (params) => {
    opened.push(params);
    return { success: true };
  });
  client.listen();
  cleanups.push(async () => {
    client.dispose();
    await server.close();
    input.destroy();
    output.destroy();
  });
  const initialized = await client.sendRequest("initialize", {
    processId: null,
    workspaceFolders: projectRoot
      ? [{ uri: pathToFileURL(projectRoot).href, name: "Synthetic project" }]
      : null,
    capabilities: {
      workspace: { applyEdit: true },
      window: { showDocument: { support: showDocument } },
    },
  });
  await client.sendNotification("initialized", {});
  const auth = { Authorization: `Bearer ${server.apiToken}` };
  const get = async (path = `/api/document?uri=${encodeURIComponent(uri)}`) => {
    const response = await fetch(server.origin + path, { headers: auth });
    return { response, data: await response.json() };
  };
  const post = async (
    path: string,
    body: unknown,
    headers: Record<string, string> = auth,
  ) => {
    const response = await fetch(server.origin + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    return { response, data: await response.json() };
  };
  const open = async () => {
    await client.sendNotification("textDocument/didOpen", {
      textDocument: { uri, languageId: "yaml", version: 1, text: source },
    });
    await expect.poll(async () => (await get()).data.revision).toBe(1);
    return (await get()).data;
  };
  const change = async (text: string, version: number) => {
    await client.sendNotification("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    });
    await expect
      .poll(async () => (await get()).data.analyzedRevision)
      .toBe(version);
    return (await get()).data;
  };
  return {
    ...server,
    input,
    client,
    get,
    post,
    open,
    change,
    auth,
    revealed,
    opened,
    initialized,
  };
}

describe("stdio LSP and secured live bridge", () => {
  it("applies YAML-safe type and parent completions without consuming quotes or comments", async () => {
    const f = await fixture();
    await f.open();
    let revision = 2;
    for (const { name, field, current } of [
      { name: "true", field: "type", current: "" },
      { name: "a: b", field: "extends", current: '"connected"' },
      { name: "#relationship", field: "type", current: "con" },
    ]) {
      const draft = `version: v1\nconnection_types:\n  ${JSON.stringify(name)}: {line-color: red}\n  child:\n    extends: ${field === "extends" ? current : "connected"} # preserve parent comment\nnodes:\n  - summary: Parent\n    connections:\n      - type: ${field === "type" ? current : "child"} # preserve type comment\n        summary: Child\n`;
      await f.change(draft, revision++);
      const prefix = `${field}: `;
      const at = offsetToPosition(
        draft,
        draft.indexOf(prefix) + prefix.length + Math.min(current.length, 3),
      );
      const items = await f.client.sendRequest<CompletionItem[]>(
        "textDocument/completion",
        { textDocument: { uri }, position: at },
      );
      const edit = items.find((item) => item.label === name)?.textEdit;
      expect(edit).toBeDefined();
      if (!edit || !("range" in edit))
        throw Error("Completion requires a scalar replacement range");
      const applied =
        draft.slice(0, positionToOffset(draft, edit.range.start)) +
        edit.newText +
        draft.slice(positionToOffset(draft, edit.range.end));
      expect(applied).toContain("# preserve parent comment");
      expect(applied).toContain("# preserve type comment");
      const snapshot = await f.change(applied, revision++);
      expect(
        snapshot.valid,
        JSON.stringify({
          name,
          field,
          applied,
          diagnostics: snapshot.diagnostics,
        }),
      ).toBe(true);
      if (field === "type") expect(snapshot.graph.edges[0].type).toBe(name);
      else expect(snapshot.vocabulary.child.lineColor).toBe("red");
    }
  });
  it("reloads project vocabulary at the same map revision, prefers live buffers and retains stale presentation", async () => {
    const root = await mkdtemp(join(tmpdir(), "lensmap-vocabulary-host-"));
    cleanups.push(() => rm(root, { recursive: true, force: true }));
    const vocabularyPath = join(root, "project.lenstypes");
    const vocabularyUri = pathToFileURL(vocabularyPath).href;
    const mapUri = pathToFileURL(join(root, "map.lensmap")).href;
    const vocabulary = (width: string) =>
      `connection_types:\n  requires:\n    extends: local_base\n    text: requires\n    reverse_text: is required by\n    stroke-width: ${width}\n`;
    const mapSource =
      "version: v1\nconnection_types:\n  local_base: {}\nnodes:\n  - full_text: Parent\n    connections:\n      - type: requires\n        full_text: Child\n";
    const typePosition = offsetToPosition(
      mapSource,
      mapSource.indexOf("requires") + 2,
    );
    await writeFile(
      join(root, "lensmap.config.json"),
      '{"types":"project.lenstypes"}',
    );
    await writeFile(vocabularyPath, vocabulary("4px"));
    const f = await fixture(false, root);
    const read = async () =>
      (await f.get(`/api/document?uri=${encodeURIComponent(mapUri)}`)).data;
    const diagnostics: { uri: string; diagnostics: unknown[] }[] = [];
    f.client.onNotification("textDocument/publishDiagnostics", (value) => {
      diagnostics.push(value);
    });
    await f.client.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: mapUri,
        languageId: "yaml",
        version: 1,
        text: mapSource,
      },
    });
    await expect.poll(async () => (await read()).pending).toBe(false);
    const first = await read();
    expect(first.valid).toBe(true);
    expect(first.graph.edges[0].presentation.strokeWidth).toBe("4px");
    const completions = await f.client.sendRequest("textDocument/completion", {
      textDocument: { uri: mapUri },
      position: typePosition,
    });
    expect(completions).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "requires" })]),
    );
    const hover = await f.client.sendRequest("textDocument/hover", {
      textDocument: { uri: mapUri },
      position: typePosition,
    });
    expect(JSON.stringify(hover)).toContain("is required by");
    const definition = await f.client.sendRequest("textDocument/definition", {
      textDocument: { uri: mapUri },
      position: typePosition,
    });
    expect(definition).toEqual(expect.objectContaining({ uri: vocabularyUri }));
    await f.client.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: vocabularyUri,
        languageId: "yaml",
        version: 1,
        text: vocabulary("6px"),
      },
    });
    await expect
      .poll(async () => (await read()).graph.edges[0].presentation.strokeWidth)
      .toBe("6px");
    const live = await read();
    expect(live.revision).toBe(1);
    expect(live.graphGeneration).toBeGreaterThan(first.graphGeneration);
    expect(live.graph.nodes.map((node: { key: string }) => node.key)).toEqual(
      first.graph.nodes.map((node: { key: string }) => node.key),
    );
    expect((await f.get("/api/session")).data.documents).toHaveLength(1);
    const inherited = await f.client.sendRequest("textDocument/hover", {
      textDocument: { uri: vocabularyUri },
      position: { line: 2, character: 16 },
    });
    expect(JSON.stringify(inherited)).toContain(mapUri);
    expect(
      await f.client.sendRequest("textDocument/definition", {
        textDocument: { uri: vocabularyUri },
        position: { line: 2, character: 16 },
      }),
    ).toEqual(expect.objectContaining({ uri: mapUri }));
    expect(
      diagnostics.filter((item) => item.uri === vocabularyUri).at(-1)
        ?.diagnostics ?? [],
    ).toEqual([]);

    await f.client.sendNotification("textDocument/didChange", {
      textDocument: { uri: vocabularyUri, version: 2 },
      contentChanges: [
        {
          text: "connection_types:\n  requires:\n    extends: missing_parent\n",
        },
      ],
    });
    await expect.poll(async () => (await read()).valid).toBe(false);
    expect((await read()).graph).toEqual(live.graph);
    expect((await read()).diagnostics[0].message).toMatch(/missing_parent/);
    expect((await read()).diagnostics[0].uri).toBe(vocabularyUri);
    const parents = await f.client.sendRequest("textDocument/completion", {
      textDocument: { uri: vocabularyUri },
      position: { line: 2, character: 24 },
    });
    expect(parents).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "connected" })]),
    );
    await expect
      .poll(() =>
        diagnostics.some(
          (item) => item.uri === vocabularyUri && item.diagnostics.length > 0,
        ),
      )
      .toBe(true);
    await writeFile(vocabularyPath, vocabulary("8px"));
    await f.client.sendNotification("textDocument/didClose", {
      textDocument: { uri: vocabularyUri },
    });
    await expect.poll(async () => (await read()).valid).toBe(true);
    expect((await read()).graph.edges[0].presentation.strokeWidth).toBe("8px");
    await writeFile(vocabularyPath, vocabulary("9px"));
    await expect
      .poll(async () => (await read()).graph.edges[0].presentation.strokeWidth)
      .toBe("9px");
    expect((await read()).revision).toBe(1);
    const configPath = join(root, "lensmap.config.json");
    const configUri = pathToFileURL(configPath).href;
    await writeFile(configPath, '{"types":"missing.lenstypes"}');
    await expect.poll(async () => (await read()).valid).toBe(false);
    expect((await read()).diagnostics[0].uri).toBe(configUri);
    expect((await read()).graph.edges[0].presentation.strokeWidth).toBe("9px");
    await expect
      .poll(
        () =>
          diagnostics.filter((item) => item.uri === configUri).at(-1)
            ?.diagnostics.length ?? 0,
      )
      .toBeGreaterThan(0);
    await writeFile(configPath, '{"types":"project.lenstypes"}');
    await expect.poll(async () => (await read()).valid).toBe(true);
  });

  it("completes supported relationship names even while a type is being written", async () => {
    const f = await fixture();
    await f.open();
    await f.change(
      "version: v1\nnodes:\n  - full_text: Parent\n    connections:\n      - type: pre\n        full_text: Child\n",
      2,
    );
    const completions = await f.client.sendRequest("textDocument/completion", {
      textDocument: { uri },
      position: { line: 4, character: 17 },
    });
    expect(completions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "precedes" }),
        expect.objectContaining({ label: "prevents" }),
        expect.objectContaining({ label: "map_link" }),
      ]),
    );
  });

  it("opens only a current attached external portal through the editor's opener", async () => {
    const f = await fixture(true);
    await f.open();
    const linkedSource =
      "version: v1\nnodes:\n  - id: external\n    type: external_link\n    url: ./readme.txt\n";
    const snapshot = await f.change(linkedSource, 2);
    const payload = {
      uri,
      key: snapshot.graph.nodes[0].key,
      baseRevision: snapshot.revision,
      attachmentId: snapshot.attachmentId,
    };
    expect(
      (await f.post("/api/open-destination", payload)).response.status,
    ).toBe(200);
    expect(f.opened).toEqual([
      { uri: "file:///synthetic/readme.txt", external: false, takeFocus: true },
    ]);
    expect(
      (
        await f.post("/api/open-destination", {
          ...payload,
          url: "file:///other",
        })
      ).response.status,
    ).toBe(400);
    expect(
      (await f.post("/api/open-destination", { ...payload, baseRevision: 1 }))
        .response.status,
    ).toBe(409);
    expect(
      (
        await f.post("/api/open-destination", {
          ...payload,
          attachmentId: "older",
        })
      ).response.status,
    ).toBe(409);
    expect(
      (
        await f.post("/api/open-destination", {
          ...payload,
          uri: "file:///unattached.lensmap",
        })
      ).response.status,
    ).toBe(404);
    const unsafe = await f.change(
      linkedSource.replace("./readme.txt", "javascript:alert(1)"),
      3,
    );
    expect(
      (
        await f.post("/api/open-destination", {
          ...payload,
          baseRevision: 3,
          key: unsafe.graph.nodes[0].key,
        })
      ).response.status,
    ).toBe(400);
    expect(f.opened).toHaveLength(1);
    for (const [index, url] of [
      "https://example.org/\npath",
      "https://example.org/#%ZZ",
    ].entries()) {
      const version = 4 + index;
      const malformed = await f.change(
        JSON.stringify({
          version: "v1",
          nodes: [{ type: "external_link", url }],
        }),
        version,
      );
      expect(
        (
          await f.post("/api/open-destination", {
            ...payload,
            key: malformed.graph.nodes[0].key,
            baseRevision: version,
          })
        ).response.status,
      ).toBe(400);
    }
    expect(f.opened).toHaveLength(1);
    const limited = await fixture();
    await limited.open();
    const limitedSnapshot = await limited.change(linkedSource, 2);
    expect(
      (
        await limited.post("/api/open-destination", {
          uri,
          key: limitedSnapshot.graph.nodes[0].key,
          baseRevision: 2,
          attachmentId: limitedSnapshot.attachmentId,
        })
      ).response.status,
    ).toBe(501);
  });

  it("uses live UTF-16 updates, current bindings and last-valid snapshots behind origin/auth checks", async () => {
    const f = await fixture();
    expect(f.initialized).toMatchObject({
      capabilities: {
        positionEncoding: "utf-16",
        textDocumentSync: 2,
        documentHighlightProvider: true,
      },
    });
    expect((await fetch(f.origin + "/api/session")).status).toBe(401);
    expect(
      (
        await fetch(f.origin + "/api/session", {
          headers: { ...f.auth, Origin: "https://untrusted.invalid" },
        })
      ).status,
    ).toBe(403);
    const reboundStatus = await new Promise<number | undefined>(
      (done, reject) => {
        const request = httpRequest(
          f.origin + "/api/session",
          { headers: { ...f.auth, Host: "rebound.invalid" } },
          (response) => {
            response.resume();
            done(response.statusCode);
          },
        );
        request.on("error", reject);
        request.end();
      },
    );
    expect(reboundStatus).toBe(403);
    expect((await fetch(f.origin + "/package.json")).status).toBe(404);
    const page = await fetch(f.origin + "/preview.html");
    expect(page.status).toBe(200);
    expect(page.headers.get("referrer-policy")).toBe("no-referrer");
    const login = await f.post(
      "/api/auth",
      { token: new URL(f.previewURL).hash.slice("#token=".length) },
      { Origin: f.origin },
    );
    expect(login.response.status).toBe(200);
    const cookie = login.response.headers.get("set-cookie")?.split(";", 1)[0];
    expect(cookie).toBeTruthy();
    if (!cookie) throw new Error("Expected a bootstrap cookie.");
    expect(
      (await f.post("/api/reveal", { uri, key: "none" }, { Cookie: cookie }))
        .response.status,
    ).toBe(403);
    const first = await f.open();
    const alpha = first.graph.nodes.find(
      (node: { id?: string }) => node.id === "alpha",
    );
    const highlights = await f.client.sendRequest(
      "textDocument/documentHighlight",
      { textDocument: { uri }, position: { line: 7, character: 19 } },
    );
    expect(highlights).toHaveLength(2);
    const events = await fetch(f.origin + "/api/events", {
      headers: f.auth,
      signal: AbortSignal.timeout(2000),
    });
    if (!events.body) throw new Error("Expected an event stream.");
    const reader = events.body.getReader();
    const initial = new TextDecoder().decode((await reader.read()).value);
    expect(initial).toContain('"type":"session"');
    await reader.cancel();
    const renamed = await f.change(source.replace("Alpha", "Café 🧭"), 2);
    expect(
      renamed.graph.nodes.find((node: { id?: string }) => node.id === "alpha")
        .key,
    ).toBe(alpha.key);
    const emojiColumn = "    summary: Café 🧭".indexOf("🧭");
    await f.client.sendNotification("textDocument/didChange", {
      textDocument: { uri, version: 3 },
      contentChanges: [
        {
          range: {
            start: { line: 3, character: emojiColumn },
            end: { line: 3, character: emojiColumn + "🧭".length },
          },
          text: "!",
        },
      ],
    });
    await expect
      .poll(async () => (await f.get()).data.analyzedRevision)
      .toBe(3);
    expect((await f.get()).data.graph.nodes[0].title).toBe("Café !");
    const invalid = await f.change("version: v1\nnodes: [", 4);
    expect(invalid).toMatchObject({ valid: false, graphRevision: 3 });
    expect(invalid.graph.nodes[0].key).toBe(alpha.key);
    expect(invalid.diagnostics.length).toBeGreaterThan(0);
    expect(
      await f.client.sendRequest("textDocument/documentHighlight", {
        textDocument: { uri },
        position: { line: 0, character: 0 },
      }),
    ).toEqual([]);
    expect(
      (await f.post("/api/reveal", { uri, key: alpha.key })).response.status,
    ).toBe(409);
    const recovered = await f.change(source, 5);
    expect(recovered.valid).toBe(true);
    expect(
      (await f.post("/api/reveal", { uri, key: recovered.graph.nodes[0].key }))
        .response.status,
    ).toBe(200);
    expect(f.revealed).toHaveLength(1);
    await f.client.sendNotification("textDocument/didClose", {
      textDocument: { uri },
    });
    await expect.poll(async () => (await f.get()).response.status).toBe(404);
  });

  it("checks base revisions, serializes edits and requires actual buffer readback rather than acknowledgment", async () => {
    const f = await fixture();
    const snapshot = await f.open();
    const key = snapshot.graph.nodes[0].key;
    let requested = 0;
    let liveSource = source;
    let version = 1;
    let apply = true;
    let notify = true;
    f.client.onRequest(
      "workspace/applyEdit",
      async (params: {
        edit: {
          documentChanges: {
            textDocument: { version: number };
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
        requested++;
        const change = params.edit.documentChanges[0];
        expect(change.textDocument.version).toBe(version);
        if (apply && notify) {
          const offset = (p: { line: number; character: number }) =>
            liveSource
              .split("\n")
              .slice(0, p.line)
              .reduce((n, line) => n + line.length + 1, 0) + p.character;
          for (const edit of [...change.edits].reverse())
            liveSource =
              liveSource.slice(0, offset(edit.range.start)) +
              edit.newText +
              liveSource.slice(offset(edit.range.end));
          await f.client.sendNotification("textDocument/didChange", {
            textDocument: { uri, version: ++version },
            contentChanges: [{ text: liveSource }],
          });
        }
        return { applied: apply };
      },
    );
    expect(
      (
        await f.post("/api/content", {
          uri,
          key,
          baseRevision: 0,
          patch: { summary: "stale" },
        })
      ).response.status,
    ).toBe(409);
    expect(requested).toBe(0);
    const confirmed = await f.post("/api/content", {
      uri,
      key,
      baseRevision: 1,
      patch: { summary: "Changed" },
    });
    expect(confirmed.data).toMatchObject({ status: "confirmed", revision: 2 });
    expect((await f.get()).data.graph.nodes[0].title).toBe("Changed");
    expect(liveSource).toContain("      - node_id: alpha");
    notify = false;
    expect(
      (
        await f.post("/api/content", {
          uri,
          key,
          baseRevision: 2,
          patch: { summary: "Not actually applied" },
        })
      ).data.status,
    ).toBe("unconfirmed");
    apply = false;
    expect(
      (
        await f.post("/api/content", {
          uri,
          key,
          baseRevision: 2,
          patch: { summary: "Rejected" },
        })
      ).data.status,
    ).toBe("rejected");
    apply = true;
    notify = true;
    const edits = await Promise.all([
      f.post("/api/content", {
        uri,
        key,
        baseRevision: 2,
        patch: { summary: "Winner" },
      }),
      f.post("/api/content", {
        uri,
        key,
        baseRevision: 2,
        patch: { summary: "Must conflict" },
      }),
    ]);
    expect(edits.map((result) => result.response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(
      (
        await f.post("/api/content", {
          uri: "file:///unattached.lensmap",
          key,
          baseRevision: 1,
          patch: { summary: "no" },
        })
      ).response.status,
    ).toBe(404);
  });

  it("closes HTTP when the editor closes stdio", async () => {
    const f = await fixture();
    await f.open();
    f.input.end();
    await expect
      .poll(async () => {
        try {
          await fetch(f.origin + "/preview.html");
          return false;
        } catch {
          return true;
        }
      })
      .toBe(true);
  });
});
