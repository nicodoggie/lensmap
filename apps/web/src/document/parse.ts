import { DocumentSession } from "@lensmap/document";
import type { GraphData } from "../graph";
import { layoutSemanticGraph } from "../semantic-layout";

export type ParseResult =
  | { ok: true; graph: GraphData }
  | { ok: false; error: string };

export function parseSource(source: string): ParseResult {
  try {
    const snapshot = new DocumentSession("playground", source).snapshot();
    if (!snapshot.valid || !snapshot.graph)
      return {
        ok: false,
        error: snapshot.diagnostics
          .map((diagnostic) => diagnostic.message)
          .join("\n"),
      };
    return { ok: true, graph: layoutSemanticGraph(snapshot.graph) };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "The document could not be parsed.",
    };
  }
}
