import {
  type NodePresentation,
  parseNodeStyle,
  resolveNodeStyle,
} from "./node-style.js";

export type { NodePresentation, NodeStyleDeclaration } from "./node-style.js";

import {
  type ConnectionPresentation,
  type ResolvedConnectionType,
  resolveVocabulary,
  type VocabularyInput,
  VocabularySchema,
} from "./vocabulary.js";

export * from "./vocabulary.js";

import type { Node } from "yaml";
import { isAlias, isMap, isScalar, parseDocument } from "yaml";
import { z } from "zod";
import {
  type ConnectionType,
  DocumentSchema,
  type Connection as RawConnection,
} from "./v1/schema.js";

export type {
  ConnectionType,
  LensmapDocument,
  Reference,
  RichNode,
} from "./v1/schema.js";
export { ConnectionTypeSchema, DocumentSchema } from "./v1/schema.js";
export function generateJSONSchema() {
  return z.toJSONSchema(DocumentSchema, { io: "input" });
}
export function generateVocabularyJSONSchema() {
  return z.toJSONSchema(VocabularySchema, { io: "input" });
}
/** Read the edge from the inspected endpoint, independently of structural kind. */
export function connectionWording(
  type: ConnectionType | undefined,
  direction: "outgoing" | "incoming",
  presentation?: ConnectionPresentation,
): string {
  if (presentation)
    return direction === "outgoing"
      ? presentation.text
      : presentation.reverseText;
  switch (type) {
    case "precedes":
      return direction === "outgoing" ? "precedes" : "follows";
    case "follows":
      return direction === "outgoing" ? "follows" : "precedes";
    case "prevents":
      return direction === "outgoing" ? "prevents" : "is prevented by";
    case "optional":
      return "optionally connected to";
    case "map_link":
      return direction === "outgoing" ? "links to map" : "map linked from";
    case "external_link":
      return direction === "outgoing"
        ? "links to resource"
        : "resource linked from";
    default:
      return "connected to";
  }
}
type AnchorThought = { readonly key: string; readonly id?: string };
/** Generated spelling is private to this rendered document version. */
export function thoughtAnchors(
  nodes: readonly AnchorThought[],
): Map<string, string> {
  const reserved = new Set(
    nodes.flatMap((node) => (node.id === undefined ? [] : [node.id])),
  );
  const anchors = new Map<string, string>();
  for (const node of nodes) {
    if (node.id !== undefined) {
      anchors.set(node.key, node.id);
      continue;
    }
    const base = `thought-${node.key}`;
    let anchor = base;
    let suffix = 0;
    while (reserved.has(anchor)) anchor = `${base}-${++suffix}`;
    reserved.add(anchor);
    anchors.set(node.key, anchor);
  }
  return anchors;
}
/** The host decodes the fragment once before calling; authored names stay exact. */
export function resolveThoughtAnchor(
  nodes: readonly AnchorThought[],
  decodedAnchor: string,
): string | undefined {
  for (const [key, anchor] of thoughtAnchors(nodes))
    if (anchor === decodedAnchor) return key;
  return undefined;
}
let attachmentSerial = 0;
export type SourcePosition = { line: number; character: number };
export type SourceRange = { start: SourcePosition; end: SourcePosition };
export type SourceSpan = { start: number; end: number };
export type Thought = {
  key: string;
  id?: string;
  title: string;
  markdown: string;
  unresolved: boolean;
  position?: { x: number; y: number };
  style?: NodePresentation;
  path: string;
  destination?: { kind: "map_link" | "external_link"; url: string };
};
export type Connection = {
  key: string;
  from: string;
  to: string;
  kind: "branch" | "cross";
  type?: ConnectionType;
  presentation?: ConnectionPresentation;
  path: string;
};
export type SemanticGraph = { nodes: Thought[]; edges: Connection[] };
export type Binding = {
  key: string;
  kind: "definition" | "reference";
  span: SourceSpan;
  ownerKey?: string;
};
export type Diagnostic = { message: string; range: SourceRange; uri?: string };
export type DocumentSnapshot = {
  vocabulary?: Record<string, ResolvedConnectionType>;
  graphGeneration?: number;
  attachmentId?: string;
  uri: string;
  revision: number;
  analyzedRevision: number | null;
  graphRevision: number | null;
  valid: boolean;
  pending: boolean;
  graph: SemanticGraph | null;
  diagnostics: Diagnostic[];
  bindings: Binding[];
};
export type ContentPatch = {
  summary?: string | null;
  full_text?: string | null;
};
export type PreparedEdit = {
  edits: { range: SourceRange; newText: string }[];
  source: string;
};
export class ContentEditError extends Error {
  constructor(
    public readonly code:
      | "stale-analysis"
      | "unknown-key"
      | "unsupported"
      | "invalid-edit",
    message: string,
  ) {
    super(message);
    this.name = "ContentEditError";
  }
}
export function positionToOffset(
  source: string,
  position: SourcePosition,
): number {
  let start = 0;
  for (let line = 0; line < Math.max(0, position.line); line++) {
    const end = source.indexOf("\n", start);
    if (end < 0) return source.length;
    start = end + 1;
  }
  const newline = source.indexOf("\n", start);
  let end = newline < 0 ? source.length : newline;
  if (end > start && source[end - 1] === "\r") end--;
  return Math.min(end, start + Math.max(0, position.character));
}
export function offsetToPosition(
  source: string,
  offset: number,
): SourcePosition {
  offset = Math.max(0, Math.min(source.length, offset));
  const before = source.slice(0, offset);
  const line = before.split("\n").length - 1;
  return { line, character: offset - (before.lastIndexOf("\n") + 1) };
}
function rejectCycles(value: unknown, ancestors = new Set<object>()) {
  if (!value || typeof value !== "object") return;
  if (ancestors.has(value))
    throw new Error(
      "YAML alias cycles are not supported; use node_id for graph cycles.",
    );
  ancestors.add(value);
  for (const child of Object.values(value)) rejectCycles(child, ancestors);
  ancestors.delete(value);
}
type RecordNode = { thought: Thought; span: SourceSpan; ast: Node | undefined };
export class DocumentSession {
  private readonly attachmentId = `attachment:${++attachmentSerial}`;
  private text: string;
  private version: number;
  private state: DocumentSnapshot;
  private records: RecordNode[] = [];
  private validSource = "";
  private serial = 0;
  constructor(
    readonly uri: string,
    source = "",
    revision = 0,
    private vocabularyInput: VocabularyInput = {},
  ) {
    this.text = source;
    this.version = revision;
    this.state = {
      uri,
      attachmentId: this.attachmentId,
      revision,
      analyzedRevision: null,
      graphRevision: null,
      valid: false,
      pending: true,
      graph: null,
      diagnostics: [],
      bindings: [],
    };
    this.analyze();
  }
  setVocabulary(input: VocabularyInput): DocumentSnapshot {
    this.vocabularyInput = input;
    return this.analyze();
  }
  get source() {
    return this.text;
  }
  get revision() {
    return this.version;
  }
  receive(source: string, revision: number) {
    this.text = source;
    this.version = revision;
    this.state = {
      ...this.state,
      revision,
      valid: false,
      pending: true,
      bindings: [],
      diagnostics: [],
    };
    return this.snapshot();
  }
  update(source: string, revision: number) {
    this.receive(source, revision);
    return this.analyze();
  }
  snapshot(): DocumentSnapshot {
    return structuredClone(this.state);
  }
  private range(span: SourceSpan): SourceRange {
    return {
      start: offsetToPosition(this.text, span.start),
      end: offsetToPosition(this.text, span.end),
    };
  }
  analyze(): DocumentSnapshot {
    try {
      const doc = parseDocument(this.text, { uniqueKeys: true });
      const problem = [...doc.errors, ...doc.warnings][0];
      if (problem)
        throw Object.assign(new Error(`YAML: ${problem.message}`), {
          offset: problem.pos[0],
        });
      const input: unknown = doc.toJS();
      rejectCycles(input);
      const result = DocumentSchema.safeParse(input);
      if (!result.success) {
        // Union alternatives report their paths at the union boundary. Locate
        // a concrete failing field in the source, not an unrelated line zero.
        const leaves = (
          issues: readonly z.core.$ZodIssue[],
          prefix: PropertyKey[] = [],
        ): z.core.$ZodIssue[] =>
          issues.flatMap((issue) => {
            const path = [...prefix, ...issue.path];
            return issue.code === "invalid_union"
              ? leaves(issue.errors.flat(), path)
              : [{ ...issue, path }];
          });
        const located = leaves(result.error.issues)
          .map((issue) => {
            const path = issue.path.filter(
              (part): part is string | number => typeof part !== "symbol",
            );
            if (issue.code === "unrecognized_keys" && issue.keys[0])
              path.push(issue.keys[0]);
            const ast = doc.getIn(path, true) as Node | undefined;
            return { issue, path, offset: ast?.range?.[0] };
          })
          .filter((item) => item.offset !== undefined)
          .sort((a, b) => b.path.length - a.path.length)[0];
        throw Object.assign(
          new Error(located?.issue.message ?? z.prettifyError(result.error)),
          { offset: located?.offset ?? 0 },
        );
      }
      const vocabulary = resolveVocabulary(
        this.vocabularyInput,
        result.data.connection_types,
        { source: this.text, uri: this.uri },
      );
      const definition = (type: string, offset = 0) => {
        if (!Object.hasOwn(vocabulary, type))
          throw Object.assign(
            new Error(
              `Unknown connection type: ${type}. Available types: ${Object.keys(vocabulary).join(", ")}`,
            ),
            { offset },
          );
        return vocabulary[type];
      };
      const styleRules = new Map<string, ReturnType<typeof parseNodeStyle>>();
      const ruleSyntax = doc.get("node_styles", true);
      const resolvedRules = isAlias(ruleSyntax)
        ? ruleSyntax.resolve(doc)
        : ruleSyntax;
      // JS objects reorder integer-looking keys. CSS rule order is the author's
      // YAML order, not Object.entries order after structural validation.
      const ruleNames = isMap(resolvedRules)
        ? resolvedRules.items.map((pair) =>
            String(isScalar(pair.key) ? pair.key.value : ""),
          )
        : Object.keys(result.data.node_styles ?? {});
      for (const name of ruleNames) {
        const style = result.data.node_styles?.[name];
        if (style === undefined) continue;
        try {
          styleRules.set(name, parseNodeStyle(style));
        } catch (error) {
          throw Object.assign(
            error instanceof Error ? error : new Error(String(error)),
            {
              offset:
                (doc.getIn(["node_styles", name], true) as Node | undefined)
                  ?.range?.[0] ?? 0,
            },
          );
        }
      }
      const records: RecordNode[] = [];
      const edges: Connection[] = [];
      const bindings: Binding[] = [];
      const refs: {
        from: string;
        id: string;
        type?: ConnectionType;
        path: string;
        span: SourceSpan;
      }[] = [];
      const ids = new Map<string, string>();
      let prefix = 0;
      while (
        prefix < this.validSource.length &&
        prefix < this.text.length &&
        this.validSource[prefix] === this.text[prefix]
      )
        prefix++;
      let suffix = 0;
      while (
        suffix < this.validSource.length - prefix &&
        suffix < this.text.length - prefix &&
        this.validSource.at(-suffix - 1) === this.text.at(-suffix - 1)
      )
        suffix++;
      const mapped = (n: number) =>
        n <= prefix
          ? n
          : n >= this.validSource.length - suffix
            ? n + this.text.length - this.validSource.length
            : -1;
      const visit = (
        entry: RawConnection,
        path: (string | number)[],
        parent?: string,
      ): void => {
        const pathName = path.join(".");
        let ast = doc.getIn(path, true) as Node | undefined;
        if (!ast) {
          for (let length = path.length - 1; length > 0; length--) {
            const ancestor = doc.getIn(path.slice(0, length), true);
            if (isAlias(ancestor)) {
              ast = ancestor;
              break;
            }
          }
        }
        // Descendants materialized from aliases point to that alias occurrence;
        // edits through aliases are explicitly unsupported.
        // Aliases are distinct occurrences with their own source span.
        const span = { start: ast?.range?.[0] ?? 0, end: ast?.range?.[1] ?? 0 };
        if (
          typeof entry === "object" &&
          entry !== null &&
          !Array.isArray(entry) &&
          "node_id" in entry
        ) {
          if (parent)
            refs.push({
              from: parent,
              id: entry.node_id,
              type: entry.type,
              path: pathName,
              span,
            });
          return;
        }
        const content =
          typeof entry === "string"
            ? { full_text: entry }
            : Array.isArray(entry)
              ? { full_text: null, connections: entry }
              : entry;
        const coreKind =
          content.type === undefined
            ? "ordinary"
            : definition(content.type, span.start).coreKind;
        if (!parent && content.type !== undefined && coreKind === "ordinary")
          throw Object.assign(
            new Error("Ordinary relationship types are not starting thoughts"),
            { offset: span.start },
          );
        if (
          (coreKind === "ordinary" && content.url !== undefined) ||
          (coreKind !== "ordinary" && content.url === undefined)
        )
          throw Object.assign(new Error("Invalid portal definition"), {
            offset: span.start,
          });
        const destination =
          (coreKind === "map_link" || coreKind === "external_link") &&
          content.url !== undefined
            ? { kind: coreKind, url: content.url }
            : undefined;
        const fallback =
          content.summary === undefined && content.full_text === undefined
            ? (destination?.url ?? "")
            : "";
        const markdown = content.full_text ?? content.summary ?? fallback;
        const title =
          content.summary !== undefined
            ? (content.summary ?? "")
            : (content.full_text ?? fallback).split(/\r?\n/, 1)[0];
        const key = `thought:${++this.serial}`;
        let style: NodePresentation | undefined;
        try {
          style = resolveNodeStyle(content.classes, content.style, styleRules);
        } catch (error) {
          throw Object.assign(
            error instanceof Error ? error : new Error(String(error)),
            {
              offset:
                (
                  doc.getIn(
                    [
                      ...path,
                      content.classes?.some((name) => !styleRules.has(name))
                        ? "classes"
                        : "style",
                    ],
                    true,
                  ) as Node | undefined
                )?.range?.[0] ?? span.start,
            },
          );
        }
        const thought: Thought = {
          key,
          id: content.id,
          title,
          markdown,
          unresolved: title.trim() === "",
          position: content.position,
          path: pathName,
          ...(destination ? { destination } : {}),
          ...(style ? { style } : {}),
        };
        records.push({ thought, span, ast });
        bindings.push({ key, kind: "definition", span });
        if (content.id !== undefined) {
          if (ids.has(content.id))
            throw new Error(`${pathName}.id: duplicate id "${content.id}".`);
          ids.set(content.id, key);
        }
        if (parent)
          edges.push({
            key: `edge:${key}`,
            from: parent,
            to: key,
            kind: "branch",
            ...(content.type !== undefined ? { type: content.type } : {}),
            path: pathName,
          });
        content.connections?.forEach((child, i) => {
          visit(
            child,
            Array.isArray(entry) ? [...path, i] : [...path, "connections", i],
            key,
          );
        });
      };
      result.data.nodes.forEach((entry, i) => {
        visit(entry, ["nodes", i]);
      });
      // Reconcile the complete parse so newly inserted copies cannot steal
      // identities from occurrences whose ranges still map to surviving text.
      const remap = new Map<string, string>();
      const remaining = new Set(records);
      const oldRemaining = new Set(this.records);
      const assign = (old: RecordNode, current: RecordNode) => {
        remap.set(current.thought.key, old.thought.key);
        remaining.delete(current);
        oldRemaining.delete(old);
      };
      for (const old of this.records) {
        const candidates = [...remaining].filter(
          (r) =>
            isMap(old.ast) === isMap(r.ast) &&
            isScalar(old.ast) === isScalar(r.ast) &&
            mapped(old.span.end) === r.span.end,
        );
        if (candidates.length === 1) assign(old, candidates[0]);
      }
      for (const old of [...oldRemaining]) {
        const candidates = [...remaining].filter((r) =>
          old.thought.id !== undefined
            ? r.thought.id === old.thought.id
            : r.thought.title === old.thought.title &&
              r.thought.markdown === old.thought.markdown,
        );
        const competing = [...oldRemaining].filter((r) =>
          old.thought.id !== undefined
            ? r.thought.id === old.thought.id
            : r.thought.title === old.thought.title &&
              r.thought.markdown === old.thought.markdown,
        );
        if (candidates.length === 1 && competing.length === 1)
          assign(old, candidates[0]);
      }
      for (const old of [...oldRemaining]) {
        const candidates = [...remaining].filter(
          (r) =>
            isMap(old.ast) === isMap(r.ast) &&
            isScalar(old.ast) === isScalar(r.ast) &&
            mapped(old.span.start) === r.span.start,
        );
        if (candidates.length === 1) assign(old, candidates[0]);
      }
      const stable = (key: string) => remap.get(key) ?? key;
      for (const record of records)
        record.thought.key = stable(record.thought.key);
      for (const binding of bindings) binding.key = stable(binding.key);
      for (const edge of edges) {
        edge.from = stable(edge.from);
        edge.to = stable(edge.to);
        edge.key = `edge:${edge.to}`;
      }
      for (const [id, key] of ids) ids.set(id, stable(key));
      for (const ref of refs) ref.from = stable(ref.from);
      const parallelReferences = new Map<string, number>();
      for (const ref of refs) {
        const to = ids.get(ref.id);
        if (!to)
          throw Object.assign(
            new Error(`${ref.path}.node_id: no node has id "${ref.id}".`),
            { offset: ref.span.start },
          );
        if (
          ref.type !== undefined &&
          definition(ref.type, ref.span.start).coreKind !== "ordinary" &&
          records.find((r) => r.thought.key === to)?.thought.destination
            ?.kind !== definition(ref.type, ref.span.start).coreKind
        )
          throw Object.assign(
            new Error(
              `${ref.path}.type: reference requires a ${ref.type} destination.`,
            ),
            { offset: ref.span.start },
          );
        const endpoints = `${ref.from}:${to}`;
        const occurrence = parallelReferences.get(endpoints) ?? 0;
        parallelReferences.set(endpoints, occurrence + 1);
        edges.push({
          key: `cross:${endpoints}:${occurrence}`,
          from: ref.from,
          to,
          kind: "cross",
          ...(ref.type !== undefined ? { type: ref.type } : {}),
          path: ref.path,
        });
        bindings.push({
          key: to,
          kind: "reference",
          span: ref.span,
          ownerKey: ref.from,
        });
      }
      for (const edge of edges)
        if (edge.type !== undefined) {
          const { coreKind: _coreKind, ...presentation } = definition(
            edge.type,
          );
          edge.presentation = presentation;
        }
      this.records = records;
      this.validSource = this.text;
      this.state = {
        uri: this.uri,
        attachmentId: this.attachmentId,
        revision: this.version,
        analyzedRevision: this.version,
        graphRevision: this.version,
        graphGeneration: (this.state.graphGeneration ?? 0) + 1,
        vocabulary,
        valid: true,
        pending: false,
        graph: { nodes: records.map((r) => r.thought), edges },
        diagnostics: [],
        bindings,
      };
    } catch (error) {
      const offset =
        typeof error === "object" && error !== null && "offset" in error
          ? Number(error.offset)
          : 0;
      const context = error as { uri?: string; source?: string };
      const diagnosticSource = context?.source ?? this.text;
      this.state = {
        ...this.state,
        analyzedRevision: this.version,
        valid: false,
        pending: false,
        bindings: [],
        diagnostics: [
          {
            message: error instanceof Error ? error.message : String(error),
            range: {
              start: offsetToPosition(diagnosticSource, offset),
              end: offsetToPosition(diagnosticSource, offset),
            },
            ...(context?.uri ? { uri: context.uri } : {}),
          },
        ],
      };
    }
    return this.snapshot();
  }
  locate(position: SourcePosition): string | undefined {
    if (!this.state.valid || this.state.pending) return;
    const offset = positionToOffset(this.text, position);
    return this.state.bindings
      .filter((b) => b.span.start <= offset && offset < b.span.end)
      .sort(
        (a, b) => a.span.end - a.span.start - (b.span.end - b.span.start),
      )[0]?.key;
  }
  definition(key: string): SourceRange | undefined {
    if (!this.state.valid || this.state.pending) return;
    const b = this.state.bindings.find(
      (b) => b.key === key && b.kind === "definition",
    );
    return b ? this.range(b.span) : undefined;
  }
  highlights(position: SourcePosition): SourceRange[] {
    const key = this.locate(position);
    return key
      ? this.state.bindings
          .filter((b) => b.key === key)
          .map((b) => this.range(b.span))
      : [];
  }
  prepareContentEdit(key: string, patch: ContentPatch): PreparedEdit {
    if (!this.state.valid || this.state.pending)
      throw new ContentEditError(
        "stale-analysis",
        "Current valid analysis is required.",
      );
    const record = this.records.find((r) => r.thought.key === key);
    if (!record)
      throw new ContentEditError("unknown-key", "Unknown thought key.");
    const ast = record.ast;
    const changes: { start: number; end: number; newText: string }[] = [];
    const unsupported = () =>
      new ContentEditError(
        "unsupported",
        "This source form cannot be edited safely.",
      );
    if (isAlias(ast)) throw unsupported();
    const scalarText = (start: number, end: number, value: string) => {
      const original = this.text.slice(start, end);
      const comment = /^[|>][0-9+-]*[ \t]*(#[^\r\n]*)/.exec(original)?.[1];
      return (
        value +
        (comment ? ` ${comment}` : "") +
        (original.endsWith("\r\n")
          ? "\r\n"
          : original.endsWith("\n")
            ? "\n"
            : "")
      );
    };
    const fields = (["summary", "full_text"] as const).filter(
      (field) => patch[field] !== undefined,
    );
    if (isScalar(ast)) {
      if (fields.includes("summary")) throw unsupported();
      if (fields.includes("full_text")) {
        if (patch.full_text === null) throw unsupported();
        changes.push({
          ...record.span,
          newText: scalarText(
            record.span.start,
            record.span.end,
            JSON.stringify(patch.full_text),
          ),
        });
      }
    } else if (isMap(ast)) {
      for (const field of fields) {
        const value = ast.get(field, true);
        const newText = JSON.stringify(patch[field]);
        if (value && isScalar(value) && value.range) {
          changes.push({
            start: value.range[0],
            end: value.range[1],
            newText: scalarText(value.range[0], value.range[1], newText),
          });
        } else if (value !== undefined) throw unsupported();
        else {
          if (ast.flow) throw unsupported();
          const first = ast.items[0]?.key;
          if (!isScalar(first) || !first.range) throw unsupported();
          const start = first.range[0];
          const lineStart = this.text.lastIndexOf("\n", start - 1) + 1;
          // Insert before the first key, retaining the existing sequence marker.
          const indent = " ".repeat(start - lineStart);
          changes.push({
            start,
            end: start,
            newText: `${field}: ${newText}\n${indent}`,
          });
        }
      }
    } else if (fields.length) throw unsupported();
    let source = this.text;
    for (const change of [...changes].sort((a, b) => b.start - a.start))
      source =
        source.slice(0, change.start) +
        change.newText +
        source.slice(change.end);
    const candidate = new DocumentSession(
      this.uri,
      source,
      this.version,
      this.vocabularyInput,
    );
    if (!candidate.snapshot().valid)
      throw new ContentEditError(
        "invalid-edit",
        "Proposed content does not form a valid document.",
      );
    return {
      source,
      edits: changes.map((c) => ({ range: this.range(c), newText: c.newText })),
    };
  }
}
