import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { extname, resolve, sep } from "node:path";
import {
  type ContentPatch,
  DocumentSession,
  type DocumentSnapshot,
  type PreparedEdit,
  positionToOffset,
  type SourcePosition,
  type SourceRange,
} from "@lensmap/document";
import {
  CodeActionKind,
  CompletionItemKind,
  createConnection,
  StreamMessageReader,
  StreamMessageWriter,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";

export interface RevealTarget {
  uri: string;
  range: SourceRange;
  source: string;
}
export interface ServerOptions {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  assets: string;
  debounceMs?: number;
  readbackTimeoutMs?: number;
  reveal?: (target: RevealTarget) => Promise<void>;
  open?: (url: string) => Promise<void>;
}
export interface ServerHandle {
  origin: string;
  previewURL: string;
  apiToken: string;
  close: () => Promise<void>;
}
interface Entry {
  session: DocumentSession;
  timer?: ReturnType<typeof setTimeout>;
}
type Message =
  | { type: "session"; documents: DocumentSnapshot[]; activeUri: string | null }
  | { type: "snapshot"; snapshot: DocumentSnapshot }
  | {
      type: "caret";
      uri: string;
      key: string | null;
      revision: number;
      sequence: number;
    }
  | { type: "focus"; uri: string; key: string; sequence: number };
class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const equalSecret = (value: string | undefined, secret: string) => {
  const left = Buffer.from(value ?? "");
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
};
function position(value: unknown): SourcePosition {
  if (
    !record(value) ||
    !Number.isSafeInteger(value.line) ||
    !Number.isSafeInteger(value.character) ||
    (value.line as number) < 0 ||
    (value.character as number) < 0
  )
    throw new HttpError(400, "Expected a zero-based UTF-16 source position.");
  return { line: value.line as number, character: value.character as number };
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value)
    throw new HttpError(400, "A document URI and thought key are required.");
  return value;
}
function contentPatch(value: unknown): ContentPatch {
  if (
    !record(value) ||
    Object.keys(value).length === 0 ||
    Object.entries(value).some(
      ([key, item]) =>
        !["summary", "full_text"].includes(key) ||
        (item !== null && typeof item !== "string"),
    )
  )
    throw new HttpError(
      400,
      "Patch must contain summary and/or full_text, each a string or null.",
    );
  return value as ContentPatch;
}
async function body(
  request: IncomingMessage,
): Promise<Record<string, unknown>> {
  let length = 0;
  const parts: Buffer[] = [];
  if (
    request.headers["content-type"]?.split(";", 1)[0].trim() !==
    "application/json"
  )
    throw new HttpError(415, "Use application/json.");
  for await (const part of request) {
    const bytes = Buffer.from(part);
    length += bytes.length;
    if (length > 1024 * 1024)
      throw new HttpError(413, "Request body is too large.");
    parts.push(bytes);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw new HttpError(400, "Malformed JSON.");
  }
  if (!record(parsed)) throw new HttpError(400, "Expected a JSON object.");
  return parsed;
}
function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

/** One editor-owned process; source never comes from HTTP-supplied file paths. */
export async function startServer(
  options: ServerOptions,
): Promise<ServerHandle> {
  // The library's raw-stream compatibility overload calls process.exit on EOF,
  // before our HTTP cleanup. Readers/writers leave lifecycle ownership here.
  const connection = createConnection(
    new StreamMessageReader(options.input),
    new StreamMessageWriter(options.output),
  );
  const entries = new Map<string, Entry>();
  const streams = new Set<ServerResponse>();
  const observers = new Set<() => void>();
  const apiToken = randomBytes(32).toString("hex");
  const bootstrapToken = randomBytes(32).toString("hex");
  const cookieToken = randomBytes(32).toString("hex");
  const cookieName = `lensmap_${randomBytes(8).toString("hex")}`;
  const assets = await realpath(options.assets);
  let activeUri: string | null = null;
  let sequence = 0;
  let closed = false;
  let shutdown = false;
  let canApply = false;
  let writeQueue: Promise<unknown> = Promise.resolve();
  let closePromise: Promise<void> | undefined;
  let origin = "";
  let previewURL = "";
  const envelope = (): Message => ({
    type: "session",
    documents: [...entries.values()].map(({ session }) => session.snapshot()),
    activeUri,
  });
  const emit = (message: Message) => {
    const frame = `data: ${JSON.stringify(message)}\n\n`;
    for (const stream of streams) {
      // A disconnected/background client must not accumulate unbounded snapshots.
      if (!stream.write(frame)) {
        stream.end();
        streams.delete(stream);
      }
    }
  };
  const entryFor = (uri: string) => {
    const entry = entries.get(uri);
    if (!entry)
      throw new HttpError(
        404,
        "Document is not attached to this editor session.",
      );
    return entry;
  };
  const current = (uri: string) => {
    const entry = entryFor(uri);
    const snapshot = entry.session.snapshot();
    if (snapshot.pending || !snapshot.valid)
      throw new HttpError(
        409,
        "Current source has not produced valid bindings.",
      );
    return entry;
  };
  const publish = (entry: Entry) => {
    const snapshot = entry.session.snapshot();
    emit({ type: "snapshot", snapshot });
    if (!snapshot.pending)
      void connection.sendDiagnostics({
        uri: snapshot.uri,
        version: snapshot.revision,
        diagnostics: snapshot.diagnostics.map((item) => ({
          ...item,
          severity: 1,
          source: "lensmap",
        })),
      });
    for (const observer of observers) observer();
  };
  const analyze = (entry: Entry) => {
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = undefined;
    entry.session.analyze();
    publish(entry);
  };
  const waitForReadback = (entry: Entry, base: number, expected: string) =>
    new Promise<boolean>((done) => {
      const matches = () =>
        !closed &&
        entries.get(entry.session.snapshot().uri) === entry &&
        entry.session.revision > base &&
        entry.session.source === expected;
      if (matches()) {
        done(true);
        return;
      }
      const finish = (result: boolean) => {
        clearTimeout(timer);
        observers.delete(check);
        done(result);
      };
      const check = () => {
        if (closed || matches()) finish(matches());
      };
      const timer = setTimeout(
        () => finish(matches()),
        options.readbackTimeoutMs ?? 1500,
      );
      observers.add(check);
    });
  const focus = (
    uri: string,
    at: SourcePosition,
    explicit: boolean,
    revision?: number,
  ) => {
    const entry = entryFor(uri);
    if (revision !== undefined && revision !== entry.session.revision)
      throw new HttpError(
        409,
        "Source changed after this command was prepared.",
      );
    const key = entry.session.locate(at) ?? null;
    activeUri = uri;
    if (explicit) {
      if (!key)
        throw new HttpError(
          409,
          "No current resolvable thought at this caret.",
        );
      emit({ type: "focus", uri, key, sequence: ++sequence });
    } else
      emit({
        type: "caret",
        uri,
        key,
        revision: entry.session.revision,
        sequence: ++sequence,
      });
    return key;
  };
  const reveal = async (uri: string, key: string) => {
    const entry = current(uri);
    const range = entry.session.definition(key);
    if (!range)
      throw new HttpError(404, "Thought has no current source definition.");
    if (!options.reveal)
      throw new HttpError(503, "Source reveal is unavailable in this host.");
    await options.reveal({ uri, range, source: entry.session.source });
    return { status: "revealed" };
  };
  const edit = (request: Record<string, unknown>) => {
    const uri = text(request.uri);
    const key = text(request.key);
    const patch = contentPatch(request.patch);
    if (!Number.isSafeInteger(request.baseRevision))
      throw new HttpError(400, "A baseRevision is required.");
    const operation = async () => {
      const entry = current(uri);
      const base = request.baseRevision as number;
      if (entry.session.revision !== base)
        throw new HttpError(
          409,
          "Base revision is no longer current. Read again before retrying.",
        );
      if (!canApply)
        throw new HttpError(409, "Editor does not support workspace edits.");
      let prepared: PreparedEdit;
      try {
        prepared = entry.session.prepareContentEdit(key, patch);
      } catch (error) {
        throw new HttpError(
          400,
          error instanceof Error ? error.message : "Content edit is invalid.",
        );
      }
      if (prepared.source === entry.session.source)
        return { status: "confirmed", revision: base };
      // Versioned LSP edits are best-effort in Zed, NOT atomic compare-and-swap.
      const result = await connection.workspace.applyEdit({
        label: "Lensmap: edit thought content",
        edit: {
          documentChanges: [
            { textDocument: { uri, version: base }, edits: prepared.edits },
          ],
        },
      });
      if (!result.applied)
        return { status: "rejected", revision: entry.session.revision };
      const confirmed = await waitForReadback(entry, base, prepared.source);
      if (confirmed && entry.session.snapshot().pending) analyze(entry);
      return {
        status: confirmed ? "confirmed" : "unconfirmed",
        revision: entry.session.revision,
      };
    };
    const result = writeQueue.then(operation);
    writeQueue = result.catch(() => undefined);
    return result;
  };
  const http = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    );
    const handle = async () => {
      if (closed || shutdown)
        throw new HttpError(503, "Editor session is closed.");
      if (
        request.headers.host !== new URL(origin).host ||
        (request.headers.origin !== undefined &&
          request.headers.origin !== origin)
      )
        throw new HttpError(403, "Untrusted Host or Origin.");
      const url = new URL(request.url ?? "/", origin);
      const method = request.method ?? "GET";
      if (url.pathname === "/api/auth" && method === "POST") {
        if (request.headers.origin !== origin)
          throw new HttpError(403, "Same-origin bootstrap required.");
        const payload = await body(request);
        if (
          typeof payload.token !== "string" ||
          !equalSecret(payload.token, bootstrapToken)
        )
          throw new HttpError(401, "Invalid preview authorization.");
        response.setHeader(
          "Set-Cookie",
          `${cookieName}=${cookieToken}; HttpOnly; SameSite=Strict; Path=/api`,
        );
        json(response, 200, { status: "authorized" });
        return;
      }
      if (url.pathname.startsWith("/api/")) {
        const bearer = request.headers.authorization?.startsWith("Bearer ")
          ? request.headers.authorization.slice(7)
          : undefined;
        const cookie = request.headers.cookie
          ?.split(";")
          .map((part) => part.trim())
          .find((part) => part.startsWith(`${cookieName}=`))
          ?.slice(cookieName.length + 1);
        const bearerOK = equalSecret(bearer, apiToken);
        if (!bearerOK && !equalSecret(cookie, cookieToken))
          throw new HttpError(401, "Preview authorization required.");
        if (method !== "GET" && !bearerOK && request.headers.origin !== origin)
          throw new HttpError(403, "Same-origin mutation required.");
        if (url.pathname === "/api/session" && method === "GET") {
          json(response, 200, envelope());
          return;
        }
        if (url.pathname === "/api/events" && method === "GET") {
          response.writeHead(200, {
            "Content-Type": "text/event-stream",
            Connection: "keep-alive",
          });
          streams.add(response);
          response.write(`data: ${JSON.stringify(envelope())}\n\n`);
          request.on("close", () => streams.delete(response));
          return;
        }
        if (url.pathname === "/api/document" && method === "GET") {
          json(
            response,
            200,
            entryFor(text(url.searchParams.get("uri"))).session.snapshot(),
          );
          return;
        }
        if (url.pathname === "/api/thought" && method === "GET") {
          const uri = text(url.searchParams.get("uri"));
          const key = text(url.searchParams.get("key"));
          const session = entryFor(uri).session;
          const snapshot = session.snapshot();
          const thought = snapshot.graph?.nodes.find(
            (node) => node.key === key,
          );
          if (!thought) throw new HttpError(404, "Unknown thought.");
          json(response, 200, {
            uri,
            revision: snapshot.revision,
            graphRevision: snapshot.graphRevision,
            valid: snapshot.valid,
            pending: snapshot.pending,
            thought,
            connections: snapshot.graph?.edges.filter(
              (edge) => edge.from === key || edge.to === key,
            ),
            range: session.definition(key) ?? null,
          });
          return;
        }
        if (
          method === "POST" &&
          ["/api/content", "/api/reveal", "/api/centre"].includes(url.pathname)
        ) {
          const payload = await body(request);
          if (url.pathname === "/api/content") {
            const result = await edit(payload);
            json(
              response,
              result.status === "confirmed"
                ? 200
                : result.status === "rejected"
                  ? 409
                  : 202,
              result,
            );
            return;
          }
          if (url.pathname === "/api/reveal") {
            json(
              response,
              200,
              await reveal(text(payload.uri), text(payload.key)),
            );
            return;
          }
          const key = focus(
            text(payload.uri),
            position(payload.position),
            true,
            typeof payload.baseRevision === "number"
              ? payload.baseRevision
              : undefined,
          );
          json(response, 200, { key });
          return;
        }
        throw new HttpError(404, "Unknown API endpoint.");
      }
      if (
        method !== "GET" ||
        (url.pathname !== "/preview.html" &&
          url.pathname !== "/" &&
          !url.pathname.startsWith("/assets/"))
      )
        throw new HttpError(404, "Not found.");
      const pathname = url.pathname === "/" ? "/preview.html" : url.pathname;
      let path: string;
      try {
        path = await realpath(
          resolve(assets, `.${decodeURIComponent(pathname)}`),
        );
      } catch {
        throw new HttpError(404, "Asset not found.");
      }
      if (!path.startsWith(assets + sep) || !(await stat(path)).isFile())
        throw new HttpError(404, "Asset not found.");
      const types: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".woff2": "font/woff2",
      };
      response.writeHead(200, {
        "Content-Type": types[extname(path)] ?? "application/octet-stream",
      });
      response.end(await readFile(path));
    };
    void handle().catch((error: unknown) => {
      if (response.headersSent) {
        response.end();
        return;
      }
      json(response, error instanceof HttpError ? error.status : 500, {
        error:
          error instanceof HttpError
            ? error.message
            : "Bridge operation failed.",
      });
    });
  });
  http.requestTimeout = 15_000;
  await new Promise<void>((done, reject) => {
    http.once("error", reject);
    http.listen(0, "127.0.0.1", () => {
      http.off("error", reject);
      done();
    });
  });
  const address = http.address();
  if (!address || typeof address === "string")
    throw new Error("Loopback endpoint did not bind.");
  origin = `http://127.0.0.1:${address.port}`;
  previewURL = `${origin}/preview.html#token=${bootstrapToken}`;
  const closeHttp = () => {
    if (closePromise) return closePromise;
    closed = true;
    for (const entry of entries.values())
      if (entry.timer) clearTimeout(entry.timer);
    for (const stream of streams) stream.end();
    streams.clear();
    for (const observer of [...observers]) observer();
    closePromise = new Promise<void>((done) => {
      http.close(() => done());
      http.closeAllConnections();
    });
    return closePromise;
  };
  const close = async () => {
    await closeHttp();
    connection.dispose();
  };
  connection.onInitialize((params) => {
    canApply = params.capabilities.workspace?.applyEdit === true;
    return {
      capabilities: {
        positionEncoding: "utf-16",
        textDocumentSync: TextDocumentSyncKind.Incremental,
        documentHighlightProvider: true,
        definitionProvider: true,
        completionProvider: { triggerCharacters: [":", " "] },
        codeActionProvider: true,
        executeCommandProvider: {
          commands: [
            "lensmap.openPreview",
            "lensmap.centrePreview",
            "lensmap.session",
          ],
        },
      },
      serverInfo: { name: "Lensmap", version: "0.0.0" },
    };
  });
  connection.onDidOpenTextDocument(({ textDocument: document }) => {
    if (
      shutdown ||
      closed ||
      (!document.uri.endsWith(".lensmap") && document.languageId !== "lensmap")
    )
      return;
    const previous = entries.get(document.uri);
    if (previous?.timer) clearTimeout(previous.timer);
    const entry = {
      session: new DocumentSession(
        document.uri,
        document.text,
        document.version,
      ),
    };
    entries.set(document.uri, entry);
    activeUri = document.uri;
    emit(envelope());
    publish(entry);
  });
  connection.onDidChangeTextDocument(
    ({ textDocument: document, contentChanges }) => {
      if (shutdown || closed) return;
      const entry = entries.get(document.uri);
      if (!entry || document.version <= entry.session.revision) return;
      let source = entry.session.source;
      try {
        for (const change of contentChanges) {
          if ("range" in change) {
            const start = positionToOffset(source, change.range.start);
            const end = positionToOffset(source, change.range.end);
            if (end < start) return;
            source = source.slice(0, start) + change.text + source.slice(end);
          } else source = change.text;
        }
        entry.session.receive(source, document.version);
        publish(entry);
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = setTimeout(() => {
          if (entries.get(document.uri) === entry && !closed) analyze(entry);
        }, options.debounceMs ?? 90);
      } catch {
        void connection.sendDiagnostics({
          uri: document.uri,
          version: document.version,
          diagnostics: [
            {
              message:
                "Invalid source synchronization range; reopen this document to resynchronize.",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
              severity: 1,
              source: "lensmap",
            },
          ],
        });
      }
    },
  );
  connection.onDidCloseTextDocument(({ textDocument }) => {
    const entry = entries.get(textDocument.uri);
    if (entry?.timer) clearTimeout(entry.timer);
    entries.delete(textDocument.uri);
    if (activeUri === textDocument.uri)
      activeUri = entries.keys().next().value ?? null;
    emit(envelope());
    for (const observer of observers) observer();
    void connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
  });
  connection.onDocumentHighlight(({ textDocument, position: at }) => {
    const entry = entries.get(textDocument.uri);
    if (!entry) return [];
    focus(textDocument.uri, at, false);
    return entry.session.highlights(at).map((range) => ({ range, kind: 1 }));
  });
  connection.onDefinition(({ textDocument, position: at }) => {
    const session = entries.get(textDocument.uri)?.session;
    const key = session?.locate(at);
    const range = key ? session?.definition(key) : undefined;
    return range ? { uri: textDocument.uri, range } : null;
  });
  connection.onCompletion(({ textDocument, position: at }) => {
    const session = entries.get(textDocument.uri)?.session;
    if (!session?.snapshot().valid || session.snapshot().pending) return [];
    const line =
      session.source.split(/\r?\n/)[at.line]?.slice(0, at.character) ?? "";
    if (!/^\s*(?:-\s*)?node_id:\s*[^#]*$/.test(line)) return [];
    return (
      session.snapshot().graph?.nodes.flatMap((node) =>
        node.id === undefined
          ? []
          : [
              {
                label: node.id,
                kind: CompletionItemKind.Reference,
                detail: node.title,
              },
            ],
      ) ?? []
    );
  });
  connection.onCodeAction(({ textDocument, range }) =>
    entries.has(textDocument.uri)
      ? [
          {
            title: "Lensmap: Open preview",
            kind: CodeActionKind.Empty,
            command: { title: "Open preview", command: "lensmap.openPreview" },
          },
          {
            title: "Lensmap: Centre preview here",
            kind: CodeActionKind.Empty,
            command: {
              title: "Centre preview",
              command: "lensmap.centrePreview",
              arguments: [
                {
                  uri: textDocument.uri,
                  position: range.start,
                  baseRevision: entryFor(textDocument.uri).session.revision,
                },
              ],
            },
          },
        ]
      : [],
  );
  connection.onExecuteCommand(async (params) => {
    if (params.command === "lensmap.session")
      return { origin, previewURL, apiToken };
    if (params.command === "lensmap.openPreview") {
      await options.open?.(previewURL);
      return { url: previewURL };
    }
    if (params.command === "lensmap.centrePreview") {
      const payload: unknown = params.arguments?.[0];
      if (!record(payload))
        throw new Error("Current caret arguments are required.");
      return {
        key: focus(
          text(payload.uri),
          position(payload.position),
          true,
          typeof payload.baseRevision === "number"
            ? payload.baseRevision
            : undefined,
        ),
      };
    }
    throw new Error("Unknown Lensmap command.");
  });
  connection.onShutdown(async () => {
    shutdown = true;
    await closeHttp();
  });
  connection.onExit(() => {
    void close();
  });
  options.input.once("end", () => {
    void close();
  });
  options.input.once("close", () => {
    void close();
  });
  connection.listen();
  return { origin, previewURL, apiToken, close };
}
