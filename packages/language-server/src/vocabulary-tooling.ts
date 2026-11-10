import {
  DocumentSession,
  offsetToPosition,
  parseVocabulary,
  positionToOffset,
  type SourcePosition,
  type SourceRange,
  type VocabularyInput,
} from "@lensmap/document";
import { isMap, isScalar, parseDocument, visit } from "yaml";

/** Reuse engine resolution for editor tooling, without publishing a second graph. */
export function analyzeVocabularyForTooling(
  uri: string,
  supplied: VocabularyInput,
  mapSource?: string,
  vocabularySource?: string,
) {
  let input = supplied;
  let local: unknown;
  if (vocabularySource !== undefined)
    input = parseVocabulary(vocabularySource, uri);
  if (mapSource !== undefined) {
    try {
      const syntax = parseDocument(mapSource, { uniqueKeys: true });
      const declarations = syntax.get("connection_types", true);
      if (!syntax.errors.length && isMap(declarations))
        local = declarations.toJSON();
    } catch {
      // Syntax diagnostics belong to the real document; still offer shared names.
    }
  }
  const snapshot = new DocumentSession(
    uri,
    JSON.stringify({
      version: "v1",
      nodes: [],
      ...(local ? { connection_types: local } : {}),
    }),
    0,
    input,
  ).snapshot();
  return { snapshot, input };
}

/** Native YAML scalar decoding preserves quoted/Unicode names exactly. */
export function typeNameAt(source: string, at: SourcePosition) {
  const syntax = parseDocument(source);
  const offset = positionToOffset(source, at);
  let name: string | undefined;
  visit(syntax, {
    Pair(_key, pair) {
      if (
        isScalar(pair.key) &&
        (pair.key.value === "type" || pair.key.value === "extends") &&
        isScalar(pair.value) &&
        typeof pair.value.value === "string" &&
        pair.value.range &&
        pair.value.range[0] <= offset &&
        offset <= pair.value.range[1]
      )
        name = pair.value.value;
    },
  });
  return name;
}

/** Replace the native scalar, including existing quotes but excluding comments. */
export function typeValueRangeAt(source: string, at: SourcePosition) {
  const offset = positionToOffset(source, at);
  let range: SourceRange | undefined;
  visit(parseDocument(source), {
    Pair(_key, pair) {
      if (
        isScalar(pair.key) &&
        pair.key.range &&
        (pair.key.value === "type" || pair.key.value === "extends") &&
        isScalar(pair.value) &&
        pair.value.range &&
        pair.value.range[1] > pair.value.range[0] &&
        pair.key.range[1] < offset &&
        offset <= pair.value.range[1]
      ) {
        let end = pair.value.range[1];
        while (end > pair.value.range[0] && /[\r\n]/.test(source[end - 1]))
          end--;
        range = {
          start: offsetToPosition(source, pair.value.range[0]),
          end: offsetToPosition(source, end),
        };
      }
    },
  });
  return range;
}

export function declaresType(source: string, name: string) {
  try {
    return Boolean(
      parseDocument(source).getIn(["connection_types", name], true),
    );
  } catch {
    return false;
  }
}
