import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { extname, resolve, sep } from "node:path";
import {
  ConnectionTypeSchema,
  type ContentPatch,
  connectionWording,
  DocumentSession,
  type DocumentSnapshot,
  offsetToPosition,
  type PreparedEdit,
  parseVocabulary,
  positionToOffset,
  type SourcePosition,
  type SourceRange,
  vocabularyLocations,
} from "@lensmap/document";
import {
  CodeActionKind,
  CompletionItemKind,
  createConnection,
  StreamMessageReader,
  StreamMessageWriter,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { ProjectVocabularies } from "./vocabulary-project.js";
import {
  analyzeVocabularyForTooling,
  declaresType,
  typeNameAt,
  typeValueRangeAt,
} from "./vocabulary-tooling.js";

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
  loading?: boolean;
  vocabularyRequest?: number;
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
  let canShowDocument = false;
  let writeQueue: Promise<unknown> = Promise.resolve();
  let closePromise: Promise<void> | undefined;
  let origin = "";
  let previewURL = "";
  let workspaceUris: string[] = [];
  const projects = new ProjectVocabularies((root, input) => {
    if (closed) return;
    for (const [uri, entry] of entries) {
      if (projects.rootFor(uri) !== root) continue;
      entry.vocabularyRequest = (entry.vocabularyRequest ?? 0) + 1;
      entry.loading = false;
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = undefined;
      entry.session.setVocabulary(input);
      publish(entry);
    }
    for (const uri of projects.resources(root)) void publishVocabulary(uri);
  });
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
  const reportedExternal = new Set<string>();
  const externalDiagnostics = (uri: string) => {
    const result = [...entries.values()].flatMap(({ session }) =>
      session.snapshot().diagnostics.filter((item) => item.uri === uri),
    );
    const buffer = projects.buffer(uri);
    if (!result.length && buffer) {
      const parsed = uri.endsWith(".lenstypes")
        ? parseVocabulary(buffer.source, uri)
        : projects.cachedInput(uri);
      if (parsed?.error && (!parsed.uri || parsed.uri === uri)) {
        const at = offsetToPosition(buffer.source, parsed.offset ?? 0);
        result.push({
          message: parsed.error,
          uri,
          range: { start: at, end: at },
        });
      }
    }
    return [
      ...new Map(result.map((item) => [JSON.stringify(item), item])).values(),
    ];
  };
  const publishExternal = () => {
    const current = new Set([
      ...projects.resources(),
      ...[...entries.values()].flatMap(({ session }) =>
        session
          .snapshot()
          .diagnostics.flatMap((item) =>
            item.uri && item.uri !== session.uri ? [item.uri] : [],
          ),
      ),
    ]);
    for (const uri of new Set([...reportedExternal, ...current])) {
      void connection.sendDiagnostics({
        uri,
        diagnostics: externalDiagnostics(uri).map((item) => ({
          ...item,
          severity: 1,
          source: "lensmap",
        })),
      });
    }
    reportedExternal.clear();
    for (const uri of current) reportedExternal.add(uri);
  };
  const publish = (entry: Entry) => {
    const snapshot = entry.session.snapshot();
    emit({ type: "snapshot", snapshot });
    if (!snapshot.pending)
      void connection.sendDiagnostics({
        uri: snapshot.uri,
        version: snapshot.revision,
        diagnostics: snapshot.diagnostics
          .filter((item) => !item.uri || item.uri === snapshot.uri)
          .map((item) => ({
            ...item,
            severity: 1,
            source: "lensmap",
          })),
      });
    publishExternal();
    for (const observer of observers) observer();
  };
  const analyze = (entry: Entry) => {
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = undefined;
    if (entry.loading) return;
    entry.session.analyze();
    publish(entry);
  };
  const loadVocabulary = async (entry: Entry) => {
    const uri = entry.session.uri;
    const request = (entry.vocabularyRequest ?? 0) + 1;
    entry.vocabularyRequest = request;
    entry.loading = true;
    const input = await projects.forUri(uri);
    if (
      closed ||
      entries.get(uri) !== entry ||
      entry.vocabularyRequest !== request
    )
      return;
    entry.loading = false;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = undefined;
    entry.session.setVocabulary(input);
    publish(entry);
  };
  const vocabularyContext = async (uri: string) => {
    const input = await projects.forUri(uri);
    const buffer = projects.buffer(uri);
    const related = [...entries].filter(
      ([mapUri]) => projects.rootFor(mapUri) === projects.rootFor(uri),
    );
    const contextualMap =
      input.uri === uri
        ? (related.find(([mapUri]) => mapUri === activeUri) ?? related[0])?.[1]
        : undefined;
    return {
      ...analyzeVocabularyForTooling(
        uri,
        input,
        entries.get(uri)?.session.source ?? contextualMap?.session.source,
        buffer && uri.endsWith(".lenstypes") ? buffer.source : undefined,
      ),
      contextualUri: contextualMap?.session.uri,
    };
  };
  const publishVocabulary = async (uri: string) => {
    const buffer = projects.buffer(uri);
    if (!buffer || closed) return;
    await projects.forUri(uri);
    if (closed || projects.buffer(uri) !== buffer) return;
    void connection.sendDiagnostics({
      uri,
      version: buffer.version,
      diagnostics: externalDiagnostics(uri).map((item) => ({
        ...item,
        severity: 1,
        source: "lensmap",
      })),
    });
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
          [
            "/api/content",
            "/api/reveal",
            "/api/centre",
            "/api/open-destination",
          ].includes(url.pathname)
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
          if (url.pathname === "/api/open-destination") {
            if (
              Object.keys(payload).some(
                (key) =>
                  !["uri", "key", "baseRevision", "attachmentId"].includes(key),
              )
            )
              throw new HttpError(
                400,
                "Provide attached thought identity, not an opening URL.",
              );
            const uri = text(payload.uri);
            const snapshot = current(uri).session.snapshot();
            if (
              payload.baseRevision !== snapshot.revision ||
              typeof payload.attachmentId !== "string" ||
              payload.attachmentId !== snapshot.attachmentId
            )
              throw new HttpError(
                409,
                "The source or attachment changed; select the portal again.",
              );
            const destination = snapshot.graph?.nodes.find(
              (node) => node.key === text(payload.key),
            )?.destination;
            if (destination?.kind !== "external_link")
              throw new HttpError(
                404,
                "No external destination on this thought.",
              );
            if (
              Array.from(destination.url).some(
                (c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127,
              )
            )
              throw new HttpError(
                400,
                "The destination address contains invalid whitespace or control characters.",
              );
            let target: URL;
            try {
              target = new URL(destination.url, uri);
              decodeURI(target.pathname);
              decodeURIComponent(target.hash.slice(1));
            } catch {
              throw new HttpError(400, "The destination address is invalid.");
            }
            if (
              !["http:", "https:", "file:"].includes(target.protocol) ||
              target.username ||
              target.password
            )
              throw new HttpError(
                400,
                "This destination scheme or embedded credentials are unsupported.",
              );
            if (!canShowDocument)
              throw new HttpError(
                501,
                "This editor does not provide a destination opener.",
              );
            // Let the editor handle URLs and files using its own preferences.
            // The preview-launching OS opener is intentionally not reused.
            const result = await connection.window.showDocument({
              uri: target.href,
              external: false,
              takeFocus: true,
            });
            if (!result.success)
              throw new HttpError(
                502,
                "The editor could not open this destination.",
              );
            json(response, 200, { opened: true });
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
    projects.dispose();
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
    workspaceUris =
      params.workspaceFolders?.map((folder) => folder.uri) ??
      (params.rootUri ? [params.rootUri] : []);
    projects.setRoots(workspaceUris);
    canApply = params.capabilities.workspace?.applyEdit === true;
    canShowDocument =
      params.capabilities.window?.showDocument?.support === true;
    return {
      capabilities: {
        positionEncoding: "utf-16",
        textDocumentSync: TextDocumentSyncKind.Incremental,
        documentHighlightProvider: true,
        definitionProvider: true,
        hoverProvider: true,
        workspace: {
          workspaceFolders: { supported: true, changeNotifications: true },
        },
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
  connection.onDidOpenTextDocument(async ({ textDocument: document }) => {
    if (shutdown || closed) return;
    if (projects.isResource(document.uri)) {
      await projects.open(document.uri, document.text, document.version);
      await publishVocabulary(document.uri);
      return;
    }
    if (
      shutdown ||
      closed ||
      (!document.uri.endsWith(".lensmap") && document.languageId !== "lensmap")
    )
      return;
    const previous = entries.get(document.uri);
    if (previous?.timer) clearTimeout(previous.timer);
    const entry: Entry = {
      session: new DocumentSession(
        document.uri,
        document.text,
        document.version,
        { error: "Project vocabulary is loading." },
      ),
    };
    entry.session.receive(document.text, document.version);
    entries.set(document.uri, entry);
    activeUri = document.uri;
    emit(envelope());
    publish(entry);
    await loadVocabulary(entry);
  });
  connection.onDidChangeTextDocument(
    async ({ textDocument: document, contentChanges }) => {
      if (shutdown || closed) return;
      const vocabulary = projects.buffer(document.uri);
      if (vocabulary) {
        if (document.version <= vocabulary.version) return;
        let source = vocabulary.source;
        for (const change of contentChanges) {
          if ("range" in change) {
            const start = positionToOffset(source, change.range.start);
            const end = positionToOffset(source, change.range.end);
            if (end < start) return;
            source = source.slice(0, start) + change.text + source.slice(end);
          } else source = change.text;
        }
        await projects.open(document.uri, source, document.version);
        await publishVocabulary(document.uri);
        return;
      }
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
  connection.onDidCloseTextDocument(async ({ textDocument }) => {
    if (projects.buffer(textDocument.uri)) {
      await projects.close(textDocument.uri);
      publishExternal();
      return;
    }
    const entry = entries.get(textDocument.uri);
    if (entry?.timer) clearTimeout(entry.timer);
    entries.delete(textDocument.uri);
    publishExternal();
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
  connection.onDefinition(async ({ textDocument, position: at }) => {
    const session = entries.get(textDocument.uri)?.session;
    const source = session?.source ?? projects.buffer(textDocument.uri)?.source;
    const name = source === undefined ? undefined : typeNameAt(source, at);
    if (name && source !== undefined) {
      const { input, contextualUri } = await vocabularyContext(
        textDocument.uri,
      );
      const sources = [
        { uri: textDocument.uri, source },
        ...(contextualUri
          ? [
              {
                uri: contextualUri,
                source: entries.get(contextualUri)?.session.source,
              },
            ]
          : []),
        { uri: input.uri, source: input.source },
      ];
      for (const candidate of sources) {
        if (!candidate.uri || candidate.source === undefined) continue;
        const locations = vocabularyLocations(candidate.source, candidate.uri);
        if (!Object.hasOwn(locations, name)) continue;
        const span = locations[name].name;
        return {
          uri: candidate.uri,
          range: {
            start: offsetToPosition(candidate.source, span.start),
            end: offsetToPosition(candidate.source, span.end),
          },
        };
      }
      return null;
    }
    const key = session?.locate(at);
    const range = key ? session?.definition(key) : undefined;
    return range ? { uri: textDocument.uri, range } : null;
  });
  connection.onCompletion(async ({ textDocument, position: at }) => {
    const session = entries.get(textDocument.uri)?.session;
    const source = session?.source ?? projects.buffer(textDocument.uri)?.source;
    if (source === undefined) return [];
    const line = source.split(/\r?\n/)[at.line]?.slice(0, at.character) ?? "";
    const prefix = /^\s*(?:-\s*)?(?:type|extends)\s*:\s*/.exec(line);
    const scalarRange = prefix ? typeValueRangeAt(source, at) : undefined;
    if (
      prefix &&
      (scalarRange || !line.slice(prefix[0].length).includes("#"))
    ) {
      const { snapshot, input } = await vocabularyContext(textDocument.uri);
      const vocabulary = snapshot.vocabulary ?? session?.snapshot().vocabulary;
      const names = new Set([
        ...ConnectionTypeSchema.options,
        ...Object.keys(vocabulary ?? {}),
        ...Object.keys(input.declarations ?? {}),
      ]);
      return [...names].map((type) => ({
        label: type,
        kind: CompletionItemKind.EnumMember,
        detail: connectionWording(
          type,
          "outgoing",
          vocabulary && Object.hasOwn(vocabulary, type)
            ? vocabulary[type]
            : undefined,
        ),
        textEdit: {
          range: scalarRange ?? {
            start: { line: at.line, character: prefix[0].length },
            end: at,
          },
          newText: JSON.stringify(type),
        },
      }));
    }
    if (!session?.snapshot().valid || session.snapshot().pending) return [];
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
  connection.onHover(async ({ textDocument, position: at }) => {
    const source =
      entries.get(textDocument.uri)?.session.source ??
      projects.buffer(textDocument.uri)?.source;
    if (source === undefined) return null;
    const name = typeNameAt(source, at);
    if (!name) return null;
    const { snapshot, input, contextualUri } = await vocabularyContext(
      textDocument.uri,
    );
    const registry = snapshot.vocabulary ?? {};
    const definition = Object.hasOwn(registry, name)
      ? registry[name]
      : undefined;
    if (!definition) return null;
    const origin = declaresType(source, name)
      ? textDocument.uri
      : contextualUri &&
          declaresType(entries.get(contextualUri)?.session.source ?? "", name)
        ? contextualUri
        : Object.hasOwn(input.declarations ?? {}, name)
          ? input.uri
          : "built-in";
    return {
      contents: {
        kind: "plaintext",
        value: `${name} (${definition.coreKind})\n${definition.text} / ${definition.reverseText}\nDefined in ${origin ?? "project vocabulary"}`,
      },
    };
  });
  connection.onNotification(
    "workspace/didChangeWorkspaceFolders",
    (params: {
      event: { added: { uri: string }[]; removed: { uri: string }[] };
    }) => {
      const deleted = new Set(params.event.removed.map((folder) => folder.uri));
      workspaceUris = [
        ...workspaceUris.filter((uri) => !deleted.has(uri)),
        ...params.event.added.map((folder) => folder.uri),
      ];
      projects.setRoots(workspaceUris);
      for (const entry of entries.values()) void loadVocabulary(entry);
    },
  );
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
